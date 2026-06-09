import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, SlotStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  DEFAULT_SLOT_PRICE,
  SLOT_CLOSE_HOUR,
  SLOT_DURATION_MINUTES,
  SLOT_GENERATION_DAYS,
  SLOT_OPEN_HOUR,
} from './slot-generation.constants.js';

const VIETNAM_UTC_OFFSET_MS = 7 * 60 * 60 * 1000;

export interface SlotGenerationResult {
  fieldId: string;
  created: number;
  skipped: number;
}

export interface SlotGenerationOptions {
  days?: number;
  startDate?: string;
}

function getVietnamDateString(date: Date = new Date()) {
  return new Date(date.getTime() + VIETNAM_UTC_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

function getVietnamDateStrings(days: number, startDate?: string) {
  const baseDate = startDate ?? getVietnamDateString();
  const [year, month, day] = baseDate.split('-').map(Number);
  const baseUtcMs = Date.UTC(year, month - 1, day);

  return Array.from({ length: days }, (_, index) =>
    new Date(baseUtcMs + index * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10),
  );
}

function dateOnly(dateString: string) {
  return new Date(`${dateString}T00:00:00.000Z`);
}

function timeOnly(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return new Date(Date.UTC(1970, 0, 1, hours, minutes, 0, 0));
}

function slotStartInstant(dateString: string, startMinutes: number) {
  const [year, month, day] = dateString.split('-').map(Number);
  const utcMs =
    Date.UTC(year, month - 1, day, 0, startMinutes, 0, 0) -
    VIETNAM_UTC_OFFSET_MS;
  return new Date(utcMs);
}

function slotKey(date: Date, startTime: Date, endTime: Date) {
  return [
    date.toISOString().slice(0, 10),
    startTime.toISOString().slice(11, 19),
    endTime.toISOString().slice(11, 19),
  ].join('|');
}

@Injectable()
export class SlotGenerationService {
  private readonly logger = new Logger(SlotGenerationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async generateForVenue(venueId: string, options: SlotGenerationOptions = {}) {
    const fields = await this.prisma.field.findMany({
      where: {
        venueId,
        isActive: true,
        venue: { isActive: true, deletedAt: null },
      },
      select: { id: true },
    });

    const results: SlotGenerationResult[] = [];
    for (const field of fields) {
      results.push(await this.generateForField(field.id, options));
    }

    return {
      venueId,
      fieldCount: fields.length,
      created: results.reduce((total, item) => total + item.created, 0),
      skipped: results.reduce((total, item) => total + item.skipped, 0),
      fields: results,
    };
  }

  async generateForField(
    fieldId: string,
    options: SlotGenerationOptions = {},
  ): Promise<SlotGenerationResult> {
    const field = await this.prisma.field.findUnique({
      where: { id: fieldId },
      select: {
        id: true,
        isActive: true,
        venue: {
          select: {
            id: true,
            isActive: true,
            deletedAt: true,
            pricePerHour: true,
          },
        },
      },
    });

    if (!field || !field.isActive || !field.venue.isActive || field.venue.deletedAt) {
      return { fieldId, created: 0, skipped: 0 };
    }

    const days = options.days ?? SLOT_GENERATION_DAYS;
    const dateStrings = getVietnamDateStrings(days, options.startDate);
    const dates = dateStrings.map(dateOnly);
    const pricePerSlot = field.venue.pricePerHour ?? DEFAULT_SLOT_PRICE;

    const existingSlots = await this.prisma.venueSlot.findMany({
      where: { fieldId, date: { in: dates } },
      select: { date: true, startTime: true, endTime: true },
    });
    const existingKeys = new Set(
      existingSlots.map((slot) =>
        slotKey(slot.date, slot.startTime, slot.endTime),
      ),
    );

    const now = new Date();
    const candidates: Prisma.VenueSlotCreateManyInput[] = [];
    const openMinutes = SLOT_OPEN_HOUR * 60;
    const closeMinutes = SLOT_CLOSE_HOUR * 60;

    for (const dateString of dateStrings) {
      const date = dateOnly(dateString);

      for (
        let startMinutes = openMinutes;
        startMinutes + SLOT_DURATION_MINUTES <= closeMinutes;
        startMinutes += SLOT_DURATION_MINUTES
      ) {
        if (slotStartInstant(dateString, startMinutes).getTime() <= now.getTime()) {
          continue;
        }

        const startTime = timeOnly(startMinutes);
        const endTime = timeOnly(startMinutes + SLOT_DURATION_MINUTES);
        const key = slotKey(date, startTime, endTime);

        if (existingKeys.has(key)) {
          continue;
        }

        existingKeys.add(key);
        candidates.push({
          fieldId,
          date,
          startTime,
          endTime,
          pricePerSlot,
          status: SlotStatus.AVAILABLE,
        });
      }
    }

    if (candidates.length === 0) {
      return { fieldId, created: 0, skipped: existingSlots.length };
    }

    const result = await this.prisma.venueSlot.createMany({
      data: candidates,
      skipDuplicates: true,
    });

    this.logger.log(
      `Generated ${result.count} slots for field ${fieldId}; skipped ${existingSlots.length}.`,
    );

    return {
      fieldId,
      created: result.count,
      skipped: existingSlots.length + candidates.length - result.count,
    };
  }

  async ensureSlotsForFieldDate(fieldId: string, date: string) {
    const field = await this.prisma.field.findUnique({
      where: { id: fieldId },
      select: {
        id: true,
        isActive: true,
        venue: { select: { isActive: true, deletedAt: true } },
      },
    });

    if (!field) {
      throw new NotFoundException(`Field with ID "${fieldId}" not found`);
    }

    if (!field.isActive || !field.venue.isActive || field.venue.deletedAt) {
      return { fieldId, created: 0, skipped: 0 };
    }

    return this.generateForField(fieldId, { days: 1, startDate: date });
  }
}

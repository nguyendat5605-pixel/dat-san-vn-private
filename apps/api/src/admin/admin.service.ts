// ============================================================
// DatSanVN — AdminService
// Business logic for admin operations: stats, user management,
// venue approval, and booking overview.
//
// KEY DESIGN DECISION:
//   Venue approval uses `venue.isActive = true` (Boolean field),
//   NOT a status enum. The VenueOwner relationship has its own
//   `status` enum (PENDING / APPROVED / REJECTED).
//   When admin "approves a venue", we:
//     1. Set venue.isActive = true
//     2. Set all PENDING VenueOwner records to APPROVED
//     3. Set the owner's User.role to OWNER
// ============================================================

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UserRole } from '@prisma/client';
import { success } from '../common/helpers/api-response.helper.js';
import { getVietnamDayRange } from '../common/helpers/vietnam-day-range.helper.js';
import { SlotGenerationService } from '../slots/slot-generation.service.js';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly slotGenerationService: SlotGenerationService,
  ) {}

  // ── Stats ──────────────────────────────────────────────────

  async getStats() {
    const { startUtc, endUtc } = getVietnamDayRange();

    const [
      totalUsers,
      totalVenues,
      totalBookings,
      pendingVenues,
      todayBookings,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.venue.count({ where: { deletedAt: null } }),
      this.prisma.booking.count(),
      this.prisma.venue.count({
        where: { isActive: false, deletedAt: null },
      }),
      this.prisma.booking.count({
        where: {
          createdAt: { gte: startUtc, lt: endUtc },
        },
      }),
    ]);

    return success(
      { totalUsers, totalVenues, totalBookings, pendingVenues, todayBookings },
      'Admin stats retrieved successfully',
    );
  }

  // ── Users ──────────────────────────────────────────────────

  async getUsers(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          avatarUrl: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count(),
    ]);

    return success(
      {
        items,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      },
      'Users retrieved successfully',
    );
  }

  async updateUserRole(userId: string, role: UserRole) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID "${userId}" not found`);
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { role },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
      },
    });

    this.logger.log(`User ${userId} role updated to ${role}`);
    return success(updated, `User role updated to ${role}`);
  }

  async deleteUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID "${userId}" not found`);
    }

    // Soft delete — deactivate user
    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });

    this.logger.log(`User ${userId} deactivated by admin`);
    return success(null, 'User deactivated successfully');
  }

  async activateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID "${userId}" not found`);
    }

    if (user.isActive) {
      return success(null, 'User is already active');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: true },
    });

    this.logger.log(`User ${userId} re-activated by admin`);
    return success(null, 'User activated successfully');
  }

  // ── Venues ─────────────────────────────────────────────────

  async getVenues(status?: string) {
    const where: Record<string, unknown> = { deletedAt: null };

    if (status === 'PENDING') {
      where.isActive = false;
    } else if (status === 'APPROVED') {
      where.isActive = true;
    }
    // 'ALL' or undefined → no filter on isActive

    const venues = await this.prisma.venue.findMany({
      where,
      include: {
        owners: {
          include: {
            user: {
              select: { id: true, fullName: true, email: true },
            },
          },
        },
        _count: { select: { fields: true, bookings: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return success(venues, 'Venues retrieved successfully');
  }

  /**
   * Approve a venue:
   *  1. Set venue.isActive = true (Prisma schema field)
   *  2. Set all PENDING VenueOwner records → APPROVED
   *  3. Promote owner's User.role → OWNER
   */
  async approveVenue(venueId: string) {
    const venue = await this.prisma.venue.findUnique({
      where: { id: venueId, deletedAt: null },
      include: {
        owners: {
          where: { status: 'PENDING' },
          select: { userId: true },
        },
      },
    });

    if (!venue) {
      throw new NotFoundException(`Venue with ID "${venueId}" not found`);
    }

    if (venue.isActive) {
      throw new BadRequestException('Venue is already approved');
    }

    // Transaction: activate venue + approve owners + promote roles
    await this.prisma.$transaction(async (tx) => {
      // 1. Activate venue
      await tx.venue.update({
        where: { id: venueId },
        data: { isActive: true },
      });

      // 2. Approve all pending ownership requests
      await tx.venueOwner.updateMany({
        where: { venueId, status: 'PENDING' },
        data: { status: 'APPROVED' },
      });

      // 3. Promote owner users to OWNER role
      const ownerUserIds = venue.owners.map((o) => o.userId);
      if (ownerUserIds.length > 0) {
        await tx.user.updateMany({
          where: {
            id: { in: ownerUserIds },
            role: 'PLAYER', // only promote if currently PLAYER
          },
          data: { role: 'OWNER' },
        });
      }
    });

    const slotGeneration =
      await this.slotGenerationService.generateForVenue(venueId);

    this.logger.log(
      `Venue ${venueId} approved; generated ${slotGeneration.created} slots, skipped ${slotGeneration.skipped}.`,
    );
    return success(
      { slotGeneration },
      'Venue approved successfully',
    );
  }

  /**
   * Reject a venue:
   *  1. Keep venue.isActive = false
   *  2. Set all PENDING VenueOwner records → REJECTED
   */
  async rejectVenue(venueId: string) {
    const venue = await this.prisma.venue.findUnique({
      where: { id: venueId, deletedAt: null },
    });

    if (!venue) {
      throw new NotFoundException(`Venue with ID "${venueId}" not found`);
    }

    const result = await this.prisma.venueOwner.updateMany({
      where: { venueId, status: 'PENDING' },
      data: { status: 'REJECTED' },
    });

    if (result.count === 0) {
      throw new BadRequestException('No pending ownership requests found');
    }

    this.logger.log(`Venue ${venueId} rejected`);
    return success(null, 'Venue rejected successfully');
  }

  // ── Bookings ───────────────────────────────────────────────

  async getAllBookings(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.booking.findMany({
        skip,
        take: limit,
        include: {
          user: {
            select: { id: true, fullName: true, email: true },
          },
          venue: {
            select: { id: true, name: true, address: true },
          },
          bookingSlots: {
            include: {
              venueSlot: {
                select: {
                  date: true,
                  startTime: true,
                  endTime: true,
                  pricePerSlot: true,
                  field: {
                    select: { id: true, name: true, sportType: true },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.booking.count(),
    ]);

    return success(
      {
        items,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      },
      'Bookings retrieved successfully',
    );
  }
}

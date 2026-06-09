import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import Redis from 'ioredis';
import { setTimeout as sleep } from 'timers/promises';
import type { ApiResponse } from '@dat-san-vn/types';
import {
  createRedisClient,
  logRedisRuntimeConfig,
} from '../config/redis.config.js';
import type { CreateBookingDto } from './dto/index.js';

type IdempotencyStatus = 'processing' | 'succeeded';

interface IdempotencyRecord {
  status: IdempotencyStatus;
  payloadHash: string;
  createdAt: string;
  response?: ApiResponse<unknown>;
}

interface BookingIdempotencyContext {
  cacheKey: string;
  payloadHash: string;
}

type StartResult =
  | { type: 'started'; context: BookingIdempotencyContext }
  | { type: 'succeeded'; response: ApiResponse<unknown> }
  | { type: 'payload_conflict' }
  | { type: 'in_progress' }
  | { type: 'unavailable' };

@Injectable()
export class BookingIdempotencyService implements OnModuleDestroy {
  private readonly logger = new Logger(BookingIdempotencyService.name);
  private readonly ttlSeconds: number;
  private redis?: Redis;

  constructor(private readonly configService: ConfigService) {
    this.ttlSeconds = this.getNumberConfig(
      'BOOKING_IDEMPOTENCY_TTL_SECONDS',
      90,
    );
    logRedisRuntimeConfig(configService, this.logger, 'Booking idempotency');
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit();
    }
  }

  async startOrGet(
    userId: string,
    dto: CreateBookingDto,
    idempotencyKey?: string,
  ): Promise<StartResult> {
    const context = this.buildContext(userId, dto, idempotencyKey);

    try {
      const redis = this.getRedis();
      const processingRecord: IdempotencyRecord = {
        status: 'processing',
        payloadHash: context.payloadHash,
        createdAt: new Date().toISOString(),
      };

      const claimed = await redis.set(
        context.cacheKey,
        JSON.stringify(processingRecord),
        'EX',
        this.ttlSeconds,
        'NX',
      );

      if (claimed === 'OK') {
        return { type: 'started', context };
      }

      const existingResult = await this.readExisting(redis, context);
      if (existingResult.type !== 'in_progress') {
        return existingResult;
      }

      return this.waitForResult(redis, context);
    } catch (error) {
      this.logger.warn(
        `Booking idempotency unavailable; continuing without cache: ${this.getErrorMessage(error)}`,
      );
      return { type: 'unavailable' };
    }
  }

  async saveSuccess(
    context: BookingIdempotencyContext,
    response: ApiResponse<unknown>,
  ) {
    try {
      const redis = this.getRedis();
      const record: IdempotencyRecord = {
        status: 'succeeded',
        payloadHash: context.payloadHash,
        createdAt: new Date().toISOString(),
        response,
      };

      await redis.set(
        context.cacheKey,
        JSON.stringify(record),
        'EX',
        this.ttlSeconds,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to cache booking idempotency response: ${this.getErrorMessage(error)}`,
      );
    }
  }

  async clear(context: BookingIdempotencyContext) {
    try {
      await this.getRedis().del(context.cacheKey);
    } catch (error) {
      this.logger.warn(
        `Failed to clear booking idempotency key: ${this.getErrorMessage(error)}`,
      );
    }
  }

  private async waitForResult(
    redis: Redis,
    context: BookingIdempotencyContext,
  ): Promise<StartResult> {
    const attempts = 20;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      await sleep(100);
      const result = await this.readExisting(redis, context);

      if (result.type !== 'in_progress') {
        return result;
      }
    }

    return { type: 'in_progress' };
  }

  private async readExisting(
    redis: Redis,
    context: BookingIdempotencyContext,
  ): Promise<StartResult> {
    const raw = await redis.get(context.cacheKey);

    if (!raw) {
      return { type: 'in_progress' };
    }

    const record = this.parseRecord(raw);
    if (!record) {
      return { type: 'in_progress' };
    }

    if (record.payloadHash !== context.payloadHash) {
      return { type: 'payload_conflict' };
    }

    if (record.status === 'succeeded' && record.response) {
      return { type: 'succeeded', response: record.response };
    }

    return { type: 'in_progress' };
  }

  private parseRecord(raw: string): IdempotencyRecord | null {
    try {
      const record = JSON.parse(raw) as Partial<IdempotencyRecord>;

      if (
        (record.status === 'processing' || record.status === 'succeeded') &&
        typeof record.payloadHash === 'string' &&
        typeof record.createdAt === 'string'
      ) {
        return record as IdempotencyRecord;
      }
    } catch {
      return null;
    }

    return null;
  }

  private buildContext(
    userId: string,
    dto: CreateBookingDto,
    idempotencyKey?: string,
  ): BookingIdempotencyContext {
    const normalizedPayload = {
      userId,
      fieldId: dto.fieldId,
      timeSlotId: dto.timeSlotId,
      note: dto.note ?? null,
      isWalkIn: false,
    };
    const payloadHash = this.hash(JSON.stringify(normalizedPayload));
    const trimmedKey = idempotencyKey?.trim();

    const cacheKey = trimmedKey
      ? `booking:create:explicit:${this.hash(`${userId}:${trimmedKey}`)}`
      : `booking:create:derived:${payloadHash}`;

    return { cacheKey, payloadHash };
  }

  private getRedis() {
    if (this.redis) {
      return this.redis;
    }

    this.redis = createRedisClient(this.configService, 'booking-idempotency', {
      connectTimeout: 1000,
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => Math.min(times * 100, 1000),
    });

    this.redis.on('error', (error) => {
      this.logger.error(
        `Redis idempotency connection error; duplicate booking protection may fail open: ${error.message}`,
      );
    });

    this.redis.on('connect', () => {
      this.logger.log('Booking idempotency Redis connection established');
    });

    return this.redis;
  }

  private getNumberConfig(key: string, fallback: number) {
    const raw = this.configService.get<string | number>(key);
    const value = typeof raw === 'number' ? raw : Number(raw);

    return Number.isFinite(value) ? value : fallback;
  }

  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}

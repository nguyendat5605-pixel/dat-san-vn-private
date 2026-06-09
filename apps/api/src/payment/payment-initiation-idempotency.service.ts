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
import type { CreatePaymentDto } from './dto/index.js';

type IdempotencyStatus = 'processing' | 'succeeded';

interface IdempotencyRecord {
  status: IdempotencyStatus;
  payloadHash: string;
  createdAt: string;
  response?: ApiResponse<unknown>;
}

export interface PaymentInitiationIdempotencyContext {
  cacheKey: string;
  payloadHash: string;
}

type StartResult =
  | { type: 'started'; context: PaymentInitiationIdempotencyContext }
  | { type: 'succeeded'; response: ApiResponse<unknown> }
  | { type: 'payload_conflict' }
  | { type: 'in_progress' }
  | { type: 'unavailable' };

@Injectable()
export class PaymentInitiationIdempotencyService implements OnModuleDestroy {
  private readonly logger = new Logger(
    PaymentInitiationIdempotencyService.name,
  );
  private readonly defaultTtlSeconds: number;
  private redis?: Redis;

  constructor(private readonly configService: ConfigService) {
    this.defaultTtlSeconds = this.getNumberConfig(
      'PAYMENT_INITIATION_IDEMPOTENCY_TTL_SECONDS',
      15 * 60,
    );
    logRedisRuntimeConfig(
      configService,
      this.logger,
      'Payment initiation idempotency',
    );
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit();
    }
  }

  async startOrGet(
    userId: string,
    dto: CreatePaymentDto,
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
        this.defaultTtlSeconds,
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
        `Payment initiation idempotency unavailable; continuing without cache: ${this.getErrorMessage(error)}`,
      );
      return { type: 'unavailable' };
    }
  }

  async saveSuccess(
    context: PaymentInitiationIdempotencyContext,
    response: ApiResponse<unknown>,
    expiresAt?: Date | null,
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
        this.getTtlSeconds(expiresAt),
      );
    } catch (error) {
      this.logger.warn(
        `Failed to cache payment initiation response: ${this.getErrorMessage(error)}`,
      );
    }
  }

  async refreshProcessingTtl(
    context: PaymentInitiationIdempotencyContext,
    expiresAt?: Date | null,
  ) {
    try {
      await this.getRedis().expire(
        context.cacheKey,
        this.getTtlSeconds(expiresAt),
      );
    } catch (error) {
      this.logger.warn(
        `Failed to refresh payment initiation idempotency TTL: ${this.getErrorMessage(error)}`,
      );
    }
  }

  async clear(context: PaymentInitiationIdempotencyContext) {
    try {
      await this.getRedis().del(context.cacheKey);
    } catch (error) {
      this.logger.warn(
        `Failed to clear payment initiation idempotency key: ${this.getErrorMessage(error)}`,
      );
    }
  }

  private async waitForResult(
    redis: Redis,
    context: PaymentInitiationIdempotencyContext,
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
    context: PaymentInitiationIdempotencyContext,
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
    dto: CreatePaymentDto,
    idempotencyKey?: string,
  ): PaymentInitiationIdempotencyContext {
    const normalizedPayload = {
      userId,
      bookingId: dto.bookingId,
      provider: dto.provider,
    };
    const payloadHash = this.hash(JSON.stringify(normalizedPayload));
    const trimmedKey = idempotencyKey?.trim();

    const cacheKey = trimmedKey
      ? `payment:initiate:explicit:${this.hash(`${userId}:${trimmedKey}`)}`
      : `payment:initiate:derived:${payloadHash}`;

    return { cacheKey, payloadHash };
  }

  private getRedis() {
    if (this.redis) {
      return this.redis;
    }

    this.redis = createRedisClient(this.configService, 'payment-idempotency', {
      connectTimeout: 1000,
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => Math.min(times * 100, 1000),
    });

    this.redis.on('error', (error) => {
      this.logger.error(
        `Redis payment idempotency connection error; duplicate payment initiation protection may fail open: ${error.message}`,
      );
    });

    this.redis.on('connect', () => {
      this.logger.log('Payment idempotency Redis connection established');
    });

    return this.redis;
  }

  private getTtlSeconds(expiresAt?: Date | null) {
    if (!expiresAt) {
      return this.defaultTtlSeconds;
    }

    const remainingSeconds = Math.ceil(
      (expiresAt.getTime() - Date.now()) / 1000,
    );

    if (remainingSeconds <= 0) {
      return 1;
    }

    return Math.max(1, Math.min(this.defaultTtlSeconds, remainingSeconds));
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

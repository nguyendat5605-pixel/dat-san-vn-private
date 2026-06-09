import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { resolvePaymentHoldTimeoutMs } from './booking-expiration.constants.js';

@Injectable()
export class BookingExpirationService implements OnModuleInit {
  private readonly logger = new Logger(BookingExpirationService.name);
  private readonly delayMs: number;
  private readonly isProduction: boolean;

  constructor(
    @InjectQueue('booking-expiration') private readonly bookingQueue: Queue,
    private readonly configService: ConfigService,
  ) {
    this.delayMs = resolvePaymentHoldTimeoutMs(this.configService);
    this.isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';

    this.bookingQueue.on('error', (error) => {
      this.logger.error(
        `BullMQ Redis connection error; booking expiration jobs are not reliable: ${error.message}`,
      );
    });
  }

  async onModuleInit() {
    try {
      const client = await this.bookingQueue.client;
      await client.ping();
      this.logger.log(
        'BullMQ Redis connection ready for booking expiration jobs',
      );
    } catch (error) {
      this.logger.error(
        'BullMQ Redis connection failed at startup; booking expiration jobs are not reliable',
        error instanceof Error ? error.stack : String(error),
      );

      if (this.isProduction) {
        throw error;
      }
    }
  }

  getExpirationDate(from = new Date()) {
    return new Date(from.getTime() + this.delayMs);
  }

  async addExpirationJob(
    bookingId: string,
    expiresAt?: Date | null,
  ): Promise<void> {
    const delay = expiresAt
      ? Math.max(expiresAt.getTime() - Date.now(), 0)
      : this.delayMs;

    try {
      await this.bookingQueue.add(
        'expire-booking',
        { bookingId },
        {
          jobId: bookingId, // Idempotent
          delay,
        },
      );
      this.logger.log(
        `Added booking expiration job for bookingId: ${bookingId} (delay: ${delay}ms)`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to add expiration job for bookingId: ${bookingId}`,
        error,
      );
    }
  }
}

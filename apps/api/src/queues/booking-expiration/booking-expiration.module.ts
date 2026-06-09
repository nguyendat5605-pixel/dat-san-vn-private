import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BookingExpirationService } from './booking-expiration.service.js';
import { BookingExpirationProcessor } from './booking-expiration.processor.js';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'booking-expiration',
    }),
  ],
  providers: [BookingExpirationService, BookingExpirationProcessor],
  exports: [BookingExpirationService],
})
export class BookingExpirationModule {}

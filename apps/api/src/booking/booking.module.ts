import { Module } from '@nestjs/common';
import { BookingController } from './booking.controller.js';
import { BookingIdempotencyService } from './booking-idempotency.service.js';
import { BookingService } from './booking.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { QueuesModule } from '../queues/queues.module.js';

@Module({
  imports: [AuthModule, QueuesModule],
  controllers: [BookingController],
  providers: [BookingService, BookingIdempotencyService],
  exports: [BookingService],
})
export class BookingModule { }

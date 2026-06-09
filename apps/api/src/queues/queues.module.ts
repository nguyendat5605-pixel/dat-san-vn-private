import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { getBullMQConfig } from '../config/bullmq.config.js';
import { BookingExpirationModule } from './booking-expiration/booking-expiration.module.js';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => getBullMQConfig(configService),
    }),
    BookingExpirationModule,
  ],
  exports: [BookingExpirationModule],
})
export class QueuesModule {}

import { ConfigService } from '@nestjs/config';
import { BookingExpirationService } from './booking-expiration.service';
import {
  DEPRECATED_BOOKING_EXPIRATION_MINUTES_MESSAGE,
  PAYMENT_HOLD_TIMEOUT_MS,
} from './booking-expiration.constants';

describe('BookingExpirationService', () => {
  function createService(config: Record<string, string | number> = {}) {
    const queue = {
      add: jest.fn(),
      on: jest.fn(),
    };
    const configService = {
      get: jest.fn((key: string) => config[key]),
    } as unknown as ConfigService;

    return {
      queue,
      service: new BookingExpirationService(queue as never, configService),
    };
  }

  it('defaults payment hold expiration to 5 minutes', () => {
    const { service } = createService();
    const from = new Date('2026-06-09T10:00:00.000Z');

    expect(service.getExpirationDate(from).getTime() - from.getTime()).toBe(
      PAYMENT_HOLD_TIMEOUT_MS,
    );
  });

  it('schedules BullMQ expiration jobs after 300000 ms by default', async () => {
    const { queue, service } = createService();

    await service.addExpirationJob('booking-1');

    expect(queue.add).toHaveBeenCalledWith(
      'expire-booking',
      { bookingId: 'booking-1' },
      {
        jobId: 'booking-1',
        delay: 300000,
      },
    );
  });

  it('uses PAYMENT_HOLD_MINUTES=5 as 300000 ms', () => {
    const { service } = createService({ PAYMENT_HOLD_MINUTES: 5 });
    const from = new Date('2026-06-09T10:00:00.000Z');

    expect(service.getExpirationDate(from).getTime() - from.getTime()).toBe(
      300000,
    );
  });

  it('does not allow deprecated BOOKING_EXPIRATION_MINUTES=15 to set a 900000 ms timeout', () => {
    expect(() => createService({ BOOKING_EXPIRATION_MINUTES: 15 })).toThrow(
      DEPRECATED_BOOKING_EXPIRATION_MINUTES_MESSAGE,
    );
  });
});

import { BadRequestException } from '@nestjs/common';
import {
  BookingStatus,
  PaymentAttemptStatus,
  PaymentProvider,
  PaymentStatus,
  SlotStatus,
} from '@prisma/client';
import { BookingService } from './booking.service';

const EXPIRED_MESSAGE =
  'Booking đã hết thời gian giữ chỗ, vui lòng làm mới danh sách.';
const PAST_SLOT_MESSAGE = 'Khung giờ này đã qua, vui lòng chọn khung giờ khác.';

function createExpiredPendingBooking() {
  return {
    id: 'booking-1',
    userId: 'user-1',
    venueId: 'venue-1',
    status: BookingStatus.PENDING,
    version: 1,
    expiresAt: new Date('2026-06-09T09:59:00.000Z'),
    bookingSlots: [
      {
        venueSlot: {
          id: 'slot-1',
          fieldId: 'field-1',
          status: SlotStatus.LOCKED,
          version: 1,
        },
      },
    ],
  };
}

function createTxMock() {
  return {
    booking: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: jest.fn(),
    },
    venueSlot: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    paymentAttempt: {
      updateMany: jest.fn(),
    },
    payment: {
      create: jest.fn(),
      updateMany: jest.fn(),
    },
  };
}

function createService({
  prismaOverrides = {},
  tx = createTxMock(),
}: {
  prismaOverrides?: Record<string, unknown>;
  tx?: ReturnType<typeof createTxMock>;
} = {}) {
  const prisma = {
    booking: {
      findUnique: jest.fn(),
    },
    venueSlot: {
      findUnique: jest.fn(),
    },
    venueOwner: {
      findUnique: jest.fn().mockResolvedValue({ status: 'APPROVED' }),
      findMany: jest.fn().mockResolvedValue([{ userId: 'owner-1' }]),
    },
    $transaction: jest.fn(async (callback: (txClient: typeof tx) => unknown) =>
      callback(tx),
    ),
    ...prismaOverrides,
  };
  const bookingExpirationService = {
    getExpirationDate: jest.fn(() => new Date('2026-06-09T10:05:00.000Z')),
    addExpirationJob: jest.fn(),
  };
  const bookingIdempotencyService = {
    startOrGet: jest.fn().mockResolvedValue({ type: 'unavailable' }),
    saveSuccess: jest.fn(),
    clear: jest.fn(),
  };
  const realtimeGateway = {
    emitBookingCreated: jest.fn(),
    emitSlotLocked: jest.fn(),
    emitSlotBooked: jest.fn(),
    emitBookingCancelled: jest.fn(),
    emitSlotReleased: jest.fn(),
  };

  const service = new BookingService(
    prisma as never,
    bookingExpirationService as never,
    bookingIdempotencyService as never,
    realtimeGateway as never,
  );

  return {
    service,
    prisma,
    tx,
    bookingExpirationService,
    bookingIdempotencyService,
    realtimeGateway,
  };
}

describe('BookingService demo safety guards', () => {
  beforeEach(() => {
    jest
      .useFakeTimers()
      .setSystemTime(new Date('2026-06-09T10:00:00.000Z').getTime());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not confirm an expired pending booking and releases the locked slot', async () => {
    const booking = createExpiredPendingBooking();
    const { service, prisma, tx, realtimeGateway } = createService();
    prisma.booking.findUnique.mockResolvedValue(booking);

    await expect(
      service.confirmBooking('booking-1', 'owner-1'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ message: EXPIRED_MESSAGE }),
    });

    expect(tx.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: BookingStatus.CANCELLED,
          cancelReason: 'AUTO_EXPIRED',
        }),
      }),
    );
    expect(tx.venueSlot.updateMany).toHaveBeenCalledWith({
      where: { id: 'slot-1', status: SlotStatus.LOCKED },
      data: { status: SlotStatus.AVAILABLE, version: { increment: 1 } },
    });
    expect(tx.booking.updateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: BookingStatus.CONFIRMED }),
      }),
    );
    expect(realtimeGateway.emitSlotReleased).toHaveBeenCalledWith(
      expect.objectContaining({ slotId: 'slot-1', status: 'AVAILABLE' }),
    );
  });

  it('does not confirm expired manual MoMo payment and marks payment expired', async () => {
    const booking = {
      ...createExpiredPendingBooking(),
      payment: {
        id: 'payment-1',
        provider: PaymentProvider.MOMO_MANUAL,
        status: PaymentStatus.PENDING,
        attempts: [
          {
            id: 'attempt-1',
            provider: PaymentProvider.MOMO_MANUAL,
            status: PaymentAttemptStatus.PENDING,
          },
        ],
      },
    };
    const { service, prisma, tx } = createService();
    prisma.booking.findUnique.mockResolvedValue(booking);

    await expect(
      service.confirmManualPayment('booking-1', 'owner-1', 'OWNER' as never),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ message: EXPIRED_MESSAGE }),
    });

    expect(tx.paymentAttempt.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: PaymentAttemptStatus.EXPIRED,
          failureCode: 'AUTO_EXPIRED',
        }),
      }),
    );
    expect(tx.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: PaymentStatus.FAILED,
          failureCode: 'AUTO_EXPIRED',
        }),
      }),
    );
    expect(tx.booking.updateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: BookingStatus.CONFIRMED }),
      }),
    );
  });

  it('does not book a past slot', async () => {
    const { service, prisma } = createService();
    prisma.venueSlot.findUnique.mockResolvedValue({
      id: 'slot-1',
      fieldId: 'field-1',
      date: new Date('2026-06-09T00:00:00.000Z'),
      startTime: new Date('1970-01-01T09:00:00.000Z'),
      status: SlotStatus.AVAILABLE,
      pricePerSlot: 100000,
      field: {
        venue: { id: 'venue-1' },
      },
    });

    await expect(
      service.createBooking('user-1', {
        fieldId: 'field-1',
        timeSlotId: 'slot-1',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ message: PAST_SLOT_MESSAGE }),
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

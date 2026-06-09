import { ConflictException, ForbiddenException } from '@nestjs/common';
import {
  BookingStatus,
  PaymentAttemptStatus,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  SlotStatus,
} from '@prisma/client';
import { PaymentService } from './payment.service';

function createTxMock() {
  return {
    paymentAttempt: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    payment: {
      updateMany: jest.fn(),
    },
    booking: {
      updateMany: jest.fn(),
    },
    venueSlot: {
      updateMany: jest.fn(),
    },
  };
}

function createService({
  nodeEnv = 'development',
  mockCompletionEnabled = true,
  tx = createTxMock(),
}: {
  nodeEnv?: string;
  mockCompletionEnabled?: boolean;
  tx?: ReturnType<typeof createTxMock>;
} = {}) {
  const prisma = {
    $transaction: jest.fn(async (callback: (tx: typeof tx) => unknown) =>
      callback(tx),
    ),
  };
  const configService = {
    get: jest.fn((key: string, fallback?: string) =>
      key === 'NODE_ENV' ? nodeEnv : fallback,
    ),
  };
  const paymentConfig = {
    isMockCompletionEnabled: jest.fn(() => mockCompletionEnabled),
  };

  const service = new PaymentService(
    prisma as never,
    configService as never,
    paymentConfig as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  return { service, prisma, tx, paymentConfig };
}

function createAttempt({
  attemptStatus = PaymentAttemptStatus.PROCESSING,
  paymentStatus = PaymentStatus.PENDING,
  bookingStatus = BookingStatus.PENDING,
  slotStatus = SlotStatus.LOCKED,
  expiresAt = new Date(Date.now() + 60_000),
}: {
  attemptStatus?: PaymentAttemptStatus;
  paymentStatus?: PaymentStatus;
  bookingStatus?: BookingStatus;
  slotStatus?: SlotStatus;
  expiresAt?: Date | null;
} = {}) {
  return {
    id: 'attempt-1',
    paymentId: 'payment-1',
    provider: PaymentProvider.MOMO,
    status: attemptStatus,
    amount: 100000,
    currency: 'VND',
    providerOrderId: 'MOMO-order-1',
    providerRequestId: 'MOMO-request-1',
    providerTransactionId: null,
    paymentUrl:
      'http://localhost:3001/payments/return?bookingId=booking-1&mockPayment=true&attemptId=attempt-1',
    expiresAt,
    paidAt: null,
    failedAt: null,
    failureCode: null,
    failureMessage: null,
    rawCreateResponse: { mock: true },
    createdAt: new Date(),
    updatedAt: new Date(),
    payment: {
      id: 'payment-1',
      bookingId: 'booking-1',
      userId: 'user-1',
      amount: 100000,
      currency: 'VND',
      method: PaymentMethod.MOMO,
      status: paymentStatus,
      provider: PaymentProvider.MOMO,
      transactionId: null,
      refundAmount: null,
      refundedAt: null,
      paidAt: null,
      failedAt: null,
      expiresAt,
      failureCode: null,
      failureMessage: null,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      booking: {
        id: 'booking-1',
        userId: 'user-1',
        venueId: 'venue-1',
        status: bookingStatus,
        totalPrice: 100000,
        note: null,
        cancelReason: null,
        refundAmount: null,
        cancelledAt: null,
        cancelledBy: null,
        expiresAt,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        bookingSlots: [
          {
            id: 'booking-slot-1',
            bookingId: 'booking-1',
            venueSlotId: 'slot-1',
            venueSlot: {
              id: 'slot-1',
              fieldId: 'field-1',
              date: new Date(),
              startTime: new Date(),
              endTime: new Date(),
              pricePerSlot: 100000,
              status: slotStatus,
              version: 1,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
        ],
      },
    },
  };
}

describe('PaymentService mock payment completion', () => {
  it('uses a 5-minute fallback when a legacy booking has no expiresAt', () => {
    const { service } = createService();
    const createdAt = new Date('2026-06-09T10:00:00.000Z');
    const expiresAt = (
      service as unknown as {
        resolveAttemptExpiresAt: (
          bookingExpiresAt: Date | null,
          bookingCreatedAt: Date,
        ) => Date;
      }
    ).resolveAttemptExpiresAt(null, createdAt);

    expect(expiresAt.getTime() - createdAt.getTime()).toBe(300000);
  });

  it('marks attempt, payment, booking, and slot as paid/booked', async () => {
    const tx = createTxMock();
    const { service } = createService({ tx });
    tx.paymentAttempt.findUnique.mockResolvedValue(createAttempt());
    tx.paymentAttempt.updateMany.mockResolvedValue({ count: 1 });
    tx.payment.updateMany.mockResolvedValue({ count: 1 });
    tx.booking.updateMany.mockResolvedValue({ count: 1 });
    tx.venueSlot.updateMany.mockResolvedValue({ count: 1 });

    const response = await service.completeMockPaymentAttempt(
      'user-1',
      'attempt-1',
    );

    expect(response.data.finalizationStatus).toBe('finalized');
    expect(tx.paymentAttempt.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: PaymentAttemptStatus.PAID }),
      }),
    );
    expect(tx.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: PaymentStatus.PAID }),
      }),
    );
    expect(tx.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: BookingStatus.CONFIRMED }),
      }),
    );
    expect(tx.venueSlot.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: SlotStatus.BOOKED }),
      }),
    );
  });

  it('is idempotent when the attempt is already finalized', async () => {
    const tx = createTxMock();
    const { service } = createService({ tx });
    tx.paymentAttempt.findUnique.mockResolvedValue(
      createAttempt({
        attemptStatus: PaymentAttemptStatus.PAID,
        paymentStatus: PaymentStatus.PAID,
        bookingStatus: BookingStatus.CONFIRMED,
        slotStatus: SlotStatus.BOOKED,
      }),
    );

    const response = await service.completeMockPaymentAttempt(
      'user-1',
      'attempt-1',
    );

    expect(response.data.finalizationStatus).toBe('already_finalized');
    expect(tx.paymentAttempt.updateMany).not.toHaveBeenCalled();
    expect(tx.payment.updateMany).not.toHaveBeenCalled();
    expect(tx.booking.updateMany).not.toHaveBeenCalled();
    expect(tx.venueSlot.updateMany).not.toHaveBeenCalled();
  });

  it('does not complete a cancelled booking', async () => {
    const tx = createTxMock();
    const { service } = createService({ tx });
    tx.paymentAttempt.findUnique.mockResolvedValue(
      createAttempt({ bookingStatus: BookingStatus.CANCELLED }),
    );

    await expect(
      service.completeMockPaymentAttempt('user-1', 'attempt-1'),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.paymentAttempt.updateMany).not.toHaveBeenCalled();
    expect(tx.payment.updateMany).not.toHaveBeenCalled();
    expect(tx.booking.updateMany).not.toHaveBeenCalled();
    expect(tx.venueSlot.updateMany).not.toHaveBeenCalled();
  });

  it('is disabled in production', async () => {
    const { service, prisma } = createService({ nodeEnv: 'production' });

    await expect(
      service.completeMockPaymentAttempt('user-1', 'attempt-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

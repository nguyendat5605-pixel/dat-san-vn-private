import { PaymentProvider, PaymentStatus, SlotStatus } from '@prisma/client';
import { BookingExpirationProcessor } from './booking-expiration.processor';

describe('BookingExpirationProcessor', () => {
  it('expires pending bookings and releases locked slots to available', async () => {
    const currentBooking = {
      id: 'booking-1',
      status: 'PENDING',
      venueId: 'venue-1',
      userId: 'user-1',
      version: 1,
      bookingSlots: [
        {
          venueSlot: {
            id: 'slot-1',
            fieldId: 'field-1',
            status: SlotStatus.LOCKED,
          },
        },
      ],
      payment: {
        id: 'payment-1',
        status: PaymentStatus.PENDING,
        provider: PaymentProvider.VNPAY,
        attempts: [],
      },
    };
    const tx = {
      booking: {
        findUnique: jest.fn().mockResolvedValue(currentBooking),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      venueSlot: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn(),
      },
      paymentAttempt: {
        updateMany: jest.fn(),
      },
      payment: {
        updateMany: jest.fn(),
      },
    };
    const prisma = {
      booking: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'booking-1',
          status: 'PENDING',
          payment: { status: PaymentStatus.PENDING },
          bookingSlots: currentBooking.bookingSlots,
        }),
      },
      $transaction: jest.fn(
        async (callback: (txClient: typeof tx) => unknown) => callback(tx),
      ),
      venueOwner: {
        findMany: jest.fn().mockResolvedValue([{ userId: 'owner-1' }]),
      },
    };
    const realtimeGateway = {
      emitBookingCancelled: jest.fn(),
      emitSlotReleased: jest.fn(),
    };
    const processor = new BookingExpirationProcessor(
      prisma as never,
      realtimeGateway as never,
    );

    await processor.process({ data: { bookingId: 'booking-1' } } as never);

    expect(tx.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'booking-1',
          status: 'PENDING',
        }),
        data: expect.objectContaining({
          status: 'CANCELLED',
          cancelReason: 'AUTO_EXPIRED',
        }),
      }),
    );
    expect(tx.venueSlot.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'slot-1',
        status: 'LOCKED',
      },
      data: { status: 'AVAILABLE', version: { increment: 1 } },
    });
    expect(realtimeGateway.emitSlotReleased).toHaveBeenCalledWith(
      expect.objectContaining({
        slotId: 'slot-1',
        status: 'AVAILABLE',
      }),
    );
  });
});

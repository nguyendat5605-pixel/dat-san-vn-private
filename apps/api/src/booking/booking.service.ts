import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import {
  BookingStatus,
  PaymentAttemptStatus,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  SlotStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CancelBookingDto, CreateBookingDto } from './dto/index.js';
import { success } from '../common/helpers/api-response.helper.js';
import { BookingExpirationService } from '../queues/booking-expiration/booking-expiration.service.js';
import { BookingIdempotencyService } from './booking-idempotency.service.js';
import {
  assertOptimisticUpdate,
  withOptimisticLock,
} from '../common/optimistic-lock.guard.js';
import {
  getVietnamDayRange,
  getVietnamDayRangeFromDateString,
  type VietnamDayRange,
} from '../common/helpers/vietnam-day-range.helper.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';

interface ManagedBookingFilters {
  status?: string;
  date?: string;
}

const BOOKING_HOLD_EXPIRED_MESSAGE =
  'Booking đã hết thời gian giữ chỗ, vui lòng làm mới danh sách.';
const PAST_SLOT_MESSAGE = 'Khung giờ này đã qua, vui lòng chọn khung giờ khác.';

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingExpirationService: BookingExpirationService,
    private readonly bookingIdempotencyService: BookingIdempotencyService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  async createBooking(
    userId: string,
    dto: CreateBookingDto,
    idempotencyKey?: string,
  ) {
    const isWalkIn = dto.isWalkIn === true;

    if (isWalkIn) {
      return this.createBookingOnce(userId, dto);
    }

    const idempotency = await this.bookingIdempotencyService.startOrGet(
      userId,
      dto,
      idempotencyKey,
    );

    if (idempotency.type === 'succeeded') {
      return idempotency.response;
    }

    if (idempotency.type === 'payload_conflict') {
      throw new ConflictException(
        'Idempotency-Key was already used with a different booking payload',
      );
    }

    if (idempotency.type === 'in_progress') {
      throw new ConflictException(
        'A booking request with this idempotency key is already in progress',
      );
    }

    if (idempotency.type === 'unavailable') {
      return this.createBookingOnce(userId, dto);
    }

    try {
      const response = await this.createBookingOnce(userId, dto);
      await this.bookingIdempotencyService.saveSuccess(
        idempotency.context,
        response,
      );

      return response;
    } catch (error) {
      await this.bookingIdempotencyService.clear(idempotency.context);
      throw error;
    }
  }

  private async createBookingOnce(userId: string, dto: CreateBookingDto) {
    const isWalkIn = dto.isWalkIn === true;

    // 1. Validate slot availability
    const slot = await this.prisma.venueSlot.findUnique({
      where: { id: dto.timeSlotId },
      include: { field: { include: { venue: true } } },
    });

    if (!slot) {
      throw new NotFoundException('Time slot not found');
    }

    if (slot.fieldId !== dto.fieldId) {
      throw new BadRequestException(
        'Time slot does not belong to the specified field',
      );
    }

    if (slot.status !== 'AVAILABLE') {
      throw new BadRequestException('Time slot is no longer available');
    }

    this.assertSlotIsFuture(slot);

    // 2. Create booking and lock slot within transaction
    const venueId = slot.field.venue.id;
    const totalPrice = slot.pricePerSlot;
    const expiresAt = isWalkIn
      ? null
      : this.bookingExpirationService.getExpirationDate();

    const booking = await this.prisma.$transaction(async (tx) => {
      // Re-verify strictly with update status assert
      const updatedSlot = await tx.venueSlot.updateMany({
        where: { id: slot.id, status: 'AVAILABLE' },
        data: {
          status: isWalkIn ? 'BOOKED' : 'LOCKED',
          version: { increment: 1 },
        },
      });

      if (updatedSlot.count === 0) {
        throw new BadRequestException(
          'Slot was taken concurrently or is no longer available',
        );
      }

      // Create Booking
      const newBooking = await tx.booking.create({
        data: {
          userId,
          venueId,
          status: isWalkIn ? BookingStatus.CONFIRMED : BookingStatus.PENDING,
          totalPrice,
          note: dto.note,
          expiresAt,
          bookingSlots: {
            create: {
              venueSlotId: slot.id,
            },
          },
        },
      });

      if (isWalkIn) {
        await tx.payment.create({
          data: {
            bookingId: newBooking.id,
            userId,
            amount: totalPrice,
            method: PaymentMethod.CASH,
            status: PaymentStatus.PAID,
            paidAt: new Date(),
          },
        });
      }

      return newBooking;
    });

    this.logger.log(`Booking created: ${booking.id} by user: ${userId}`);
    console.log('[BookingCreate]', {
      bookingId: booking.id,
      bookingStatus: booking.status,
      venueId,
      fieldId: slot.fieldId,
      userId,
      venueOwnerId: slot.field.venue.id,
    });
    await this.emitBookingCreatedEvents({
      bookingId: booking.id,
      venueId,
      fieldId: slot.fieldId,
      slotId: slot.id,
      userId,
      bookingStatus: booking.status,
      slotStatus: isWalkIn ? 'BOOKED' : 'LOCKED',
      totalPrice: Number(totalPrice),
      expiresAt: booking.expiresAt,
    });

    if (!isWalkIn) {
      // Phase 5: Hook into Booking Flow
      await this.bookingExpirationService.addExpirationJob(
        booking.id,
        booking.expiresAt,
      );
    }

    return success(booking, 'Booking created successfully', 201);
  }

  async confirmBooking(bookingId: string, ownerId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        bookingSlots: {
          include: {
            venueSlot: {
              select: { id: true, fieldId: true, status: true, version: true },
            },
          },
        },
      },
    });

    if (!booking) throw new NotFoundException('Booking not found');

    // Verify owner
    const ownership = await this.prisma.venueOwner.findUnique({
      where: { userId_venueId: { userId: ownerId, venueId: booking.venueId } },
    });

    if (!ownership || ownership.status !== 'APPROVED') {
      throw new ForbiddenException(
        'You do not have permission to confirm this booking',
      );
    }

    if (booking.status !== 'PENDING') {
      throw new BadRequestException(
        `Booking is in ${booking.status} status and cannot be confirmed`,
      );
    }

    await this.assertBookingStillWithinHold(booking);

    const updated = await withOptimisticLock(
      () =>
        this.prisma.$transaction(async (tx) => {
          const bookingUpdate = await tx.booking.updateMany({
            where: {
              id: bookingId,
              version: booking.version,
              status: 'PENDING',
            },
            data: {
              status: 'CONFIRMED',
              confirmedAt: new Date(),
              version: { increment: 1 },
            },
          });
          assertOptimisticUpdate(bookingUpdate);

          // Mark slots as BOOKED
          for (const bs of booking.bookingSlots) {
            const slotUpdate = await tx.venueSlot.updateMany({
              where: {
                id: bs.venueSlot.id,
                version: bs.venueSlot.version,
                status: 'LOCKED',
              },
              data: { status: 'BOOKED', version: { increment: 1 } },
            });
            assertOptimisticUpdate(
              slotUpdate,
              'Slot đã thay đổi, vui lòng thử lại',
            );
          }

          return tx.booking.findUniqueOrThrow({
            where: { id: bookingId },
          });
        }),
      booking.version,
    );

    this.logger.log(`Booking confirmed: ${bookingId} by owner: ${ownerId}`);
    await this.emitBookingConfirmedEvents({
      bookingId,
      venueId: booking.venueId,
      userId: booking.userId,
      ownerIds: await this.getVenueOwnerIds(booking.venueId),
      slots: booking.bookingSlots.map((bookingSlot) => ({
        id: bookingSlot.venueSlot.id,
        fieldId: bookingSlot.venueSlot.fieldId,
      })),
    });
    return success(updated, 'Booking confirmed successfully');
  }

  async confirmManualPayment(
    bookingId: string,
    actorId: string,
    actorRole: UserRole,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        payment: {
          include: {
            attempts: {
              where: { provider: PaymentProvider.MOMO_MANUAL },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
        bookingSlots: {
          include: {
            venueSlot: {
              select: { id: true, fieldId: true, status: true, version: true },
            },
          },
        },
      },
    });

    if (!booking) throw new NotFoundException('Booking not found');

    if (actorRole !== UserRole.ADMIN) {
      const ownership = await this.prisma.venueOwner.findUnique({
        where: {
          userId_venueId: { userId: actorId, venueId: booking.venueId },
        },
      });

      if (!ownership || ownership.status !== 'APPROVED') {
        throw new ForbiddenException(
          'You do not have permission to confirm this booking',
        );
      }
    }

    if (booking.status === BookingStatus.CONFIRMED) {
      return success(booking, 'Booking already confirmed');
    }

    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException(
        `Booking is in ${booking.status} status and cannot be confirmed`,
      );
    }

    await this.assertBookingStillWithinHold(booking);

    const manualAttempt = booking.payment?.attempts[0] ?? null;
    if (
      !booking.payment ||
      booking.payment.provider !== PaymentProvider.MOMO_MANUAL ||
      booking.payment.status !== PaymentStatus.PENDING ||
      !manualAttempt ||
      manualAttempt.status !== PaymentAttemptStatus.PENDING
    ) {
      throw new BadRequestException(
        'Booking does not have a pending manual MoMo payment',
      );
    }

    const payment = booking.payment;

    const result = await this.prisma.$transaction(async (tx) => {
      const now = new Date();

      const attemptUpdate = await tx.paymentAttempt.updateMany({
        where: {
          id: manualAttempt.id,
          provider: PaymentProvider.MOMO_MANUAL,
          status: PaymentAttemptStatus.PENDING,
        },
        data: {
          status: PaymentAttemptStatus.PAID,
          paidAt: now,
          failedAt: null,
          failureCode: null,
          failureMessage: null,
          providerTransactionId: `MOMO-MANUAL-${booking.id}`,
        },
      });
      assertOptimisticUpdate(attemptUpdate);

      const paymentUpdate = await tx.payment.updateMany({
        where: {
          id: payment.id,
          provider: PaymentProvider.MOMO_MANUAL,
          status: PaymentStatus.PENDING,
        },
        data: {
          status: PaymentStatus.PAID,
          transactionId: `MOMO-MANUAL-${booking.id}`,
          paidAt: now,
          failedAt: null,
          failureCode: null,
          failureMessage: null,
          version: { increment: 1 },
        },
      });
      assertOptimisticUpdate(paymentUpdate);

      const bookingUpdate = await tx.booking.updateMany({
        where: {
          id: booking.id,
          status: BookingStatus.PENDING,
        },
        data: {
          status: BookingStatus.CONFIRMED,
          confirmedAt: now,
          version: { increment: 1 },
        },
      });
      assertOptimisticUpdate(bookingUpdate);

      for (const bookingSlot of booking.bookingSlots) {
        const slotUpdate = await tx.venueSlot.updateMany({
          where: {
            id: bookingSlot.venueSlot.id,
            status: SlotStatus.LOCKED,
          },
          data: { status: SlotStatus.BOOKED, version: { increment: 1 } },
        });
        assertOptimisticUpdate(
          slotUpdate,
          'Slot đã thay đổi, vui lòng thử lại',
        );
      }

      return tx.booking.findUniqueOrThrow({
        where: { id: booking.id },
      });
    });

    const ownerIds = await this.getVenueOwnerIds(booking.venueId);
    this.emitManualPaymentConfirmedEvents({
      bookingId: booking.id,
      paymentId: payment.id,
      attemptId: manualAttempt.id,
      venueId: booking.venueId,
      userId: booking.userId,
      ownerIds,
      slots: booking.bookingSlots.map((bookingSlot) => ({
        id: bookingSlot.venueSlot.id,
        fieldId: bookingSlot.venueSlot.fieldId,
      })),
    });

    this.logger.log(
      `Manual MoMo payment confirmed for booking: ${bookingId} by ${actorId}`,
    );
    return success(result, 'Manual MoMo payment confirmed successfully');
  }

  async cancelBooking(
    bookingId: string,
    userId: string,
    isOwnerCancel: boolean = false,
    reason?: string,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        bookingSlots: {
          include: {
            venueSlot: {
              select: {
                id: true,
                fieldId: true,
                date: true,
                startTime: true,
                status: true,
                version: true,
              },
            },
          },
        },
      },
    });

    if (!booking) throw new NotFoundException('Booking not found');

    if (!isOwnerCancel) {
      if (booking.userId !== userId) {
        throw new ForbiddenException('You can only cancel your own bookings');
      }
      if (
        booking.status !== BookingStatus.PENDING &&
        booking.status !== BookingStatus.CONFIRMED
      ) {
        throw new BadRequestException('Không thể hủy booking này');
      }
    } else {
      // Owner cancel
      const ownership = await this.prisma.venueOwner.findUnique({
        where: { userId_venueId: { userId, venueId: booking.venueId } },
      });
      if (!ownership || ownership.status !== 'APPROVED') {
        throw new ForbiddenException(
          'You do not have permission to cancel this booking as an owner',
        );
      }

      if (booking.status === 'CONFIRMED') {
        const bookingStart = this.getBookingStartDate(booking.bookingSlots);

        if (bookingStart.getTime() - Date.now() <= 24 * 60 * 60 * 1000) {
          throw new BadRequestException(
            'Confirmed bookings can only be cancelled by owners more than 24 hours in advance',
          );
        }
      }
    }

    if (booking.status === 'CANCELLED' || booking.status === 'COMPLETED') {
      throw new BadRequestException(`Booking is already ${booking.status}`);
    }

    const refundPercent = this.getRefundPercent(
      this.getBookingStartDate(booking.bookingSlots),
    );
    const refundAmount = Number(booking.totalPrice) * (refundPercent / 100);

    const updated = await withOptimisticLock(
      () =>
        this.prisma.$transaction(async (tx) => {
          const bookingUpdate = await tx.booking.updateMany({
            where: {
              id: bookingId,
              version: booking.version,
              status: booking.status,
            },
            data: {
              status: 'CANCELLED',
              cancelledAt: new Date(),
              cancelledBy: userId,
              cancelReason: reason,
              refundAmount,
              version: { increment: 1 },
            },
          });
          assertOptimisticUpdate(bookingUpdate);

          if (refundAmount > 0) {
            await tx.payment.updateMany({
              where: { bookingId },
              data: {
                refundAmount,
                refundedAt: new Date(),
                status:
                  refundPercent === 100
                    ? PaymentStatus.REFUNDED_FULL
                    : PaymentStatus.REFUNDED_HALF,
              },
            });
          }

          // Release slots back to AVAILABLE
          for (const bs of booking.bookingSlots) {
            const slotUpdate = await tx.venueSlot.updateMany({
              where: {
                id: bs.venueSlot.id,
                version: bs.venueSlot.version,
                status: { in: ['LOCKED', 'BOOKED'] },
              },
              data: { status: 'AVAILABLE', version: { increment: 1 } },
            });
            assertOptimisticUpdate(
              slotUpdate,
              'Slot đã thay đổi, vui lòng thử lại',
            );
          }

          return tx.booking.findUniqueOrThrow({
            where: { id: bookingId },
          });
        }),
      booking.version,
    );

    this.logger.log(`Booking cancelled: ${bookingId} by ${userId}`);
    await this.emitBookingCancelledEvents({
      bookingId,
      venueId: booking.venueId,
      userId: booking.userId,
      ownerIds: await this.getVenueOwnerIds(booking.venueId),
      slots: booking.bookingSlots.map((bookingSlot) => ({
        id: bookingSlot.venueSlot.id,
        fieldId: bookingSlot.venueSlot.fieldId,
      })),
    });
    return success(
      {
        ...updated,
        refundPercent,
      },
      `Đã hủy booking. Hoàn tiền ${refundPercent}% (${refundAmount})`,
    );
  }

  async cancelMyBooking(dto: CancelBookingDto, userId: string) {
    return this.cancelBooking(dto.bookingId, userId, false, dto.reason);
  }

  async getMyBookings(userId: string) {
    const bookings = await this.prisma.booking.findMany({
      where: { userId },
      include: {
        venue: { select: { id: true, name: true, address: true } },
        bookingSlots: {
          include: {
            venueSlot: {
              include: { field: { select: { name: true, sportType: true } } },
            },
          },
        },
        payment: {
          select: {
            status: true,
            provider: true,
            attempts: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: {
                provider: true,
                status: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return success(bookings, 'User bookings retrieved successfully');
  }

  async getManagedBookings(
    userId: string,
    role: UserRole,
    filters: ManagedBookingFilters = {},
  ) {
    const where: Record<string, unknown> = {};
    const normalizedStatus =
      filters.status && filters.status !== 'ALL' ? filters.status : undefined;

    if (normalizedStatus) {
      if (
        !Object.values(BookingStatus).includes(
          normalizedStatus as BookingStatus,
        )
      ) {
        throw new BadRequestException('Invalid booking status filter');
      }

      where.status = normalizedStatus;
    }

    const vietnamDateRange = this.parseDateFilter(filters.date);
    if (vietnamDateRange) {
      where.bookingSlots = {
        some: {
          venueSlot: {
            date: {
              gte: vietnamDateRange.startUtc,
              lt: vietnamDateRange.endUtc,
            },
          },
        },
      };
    }

    if (role !== UserRole.ADMIN) {
      where.venue = {
        owners: {
          some: {
            userId,
            status: 'APPROVED',
          },
        },
      };
    }

    const bookings = await this.prisma.booking.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
          },
        },
        venue: {
          select: {
            id: true,
            name: true,
            address: true,
            isActive: true,
          },
        },
        bookingSlots: {
          include: {
            venueSlot: {
              select: {
                id: true,
                date: true,
                startTime: true,
                endTime: true,
                pricePerSlot: true,
                field: {
                  select: {
                    id: true,
                    name: true,
                    sportType: true,
                    size: true,
                  },
                },
              },
            },
          },
        },
        payment: {
          select: {
            status: true,
            provider: true,
            attempts: {
              orderBy: { createdAt: 'desc' as const },
              take: 1,
              select: {
                provider: true,
                status: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log('[OwnerBookingsFetch]', {
      userId,
      role,
      count: bookings.length,
      bookings: bookings.map((b: any) => ({
        id: b.id,
        status: b.status,
        paymentStatus: b.payment?.status,
        provider: b.payment?.provider,
        venueId: b.venueId,
      })),
    });

    return success(bookings, 'Managed bookings retrieved successfully');
  }

  private async emitBookingCreatedEvents(input: {
    bookingId: string;
    venueId: string;
    fieldId: string;
    slotId: string;
    userId: string;
    bookingStatus: string;
    slotStatus: string;
    totalPrice: number;
    expiresAt?: Date | null;
  }) {
    const ownerIds = await this.getVenueOwnerIds(input.venueId);
    const updatedAt = new Date();
    const roomPayload = {
      bookingId: input.bookingId,
      venueId: input.venueId,
      fieldId: input.fieldId,
      userId: input.userId,
      ownerIds,
      updatedAt,
    };

    this.realtimeGateway.emitBookingCreated({
      ...roomPayload,
      status: input.bookingStatus,
      totalPrice: input.totalPrice,
      expiresAt: input.expiresAt ?? null,
    });

    if (input.slotStatus === 'LOCKED') {
      this.realtimeGateway.emitSlotLocked({
        ...roomPayload,
        slotId: input.slotId,
        status: input.slotStatus,
      });
      return;
    }

    this.realtimeGateway.emitSlotBooked({
      ...roomPayload,
      slotId: input.slotId,
      status: input.slotStatus,
    });
  }

  private async emitBookingConfirmedEvents(input: {
    bookingId: string;
    venueId: string;
    userId: string;
    ownerIds: string[];
    slots: Array<{ id: string; fieldId: string }>;
  }) {
    const updatedAt = new Date();
    this.realtimeGateway.emitBookingConfirmed({
      bookingId: input.bookingId,
      venueId: input.venueId,
      userId: input.userId,
      ownerIds: input.ownerIds,
      status: BookingStatus.CONFIRMED,
      updatedAt,
    });

    for (const slot of input.slots) {
      this.realtimeGateway.emitSlotBooked({
        bookingId: input.bookingId,
        venueId: input.venueId,
        fieldId: slot.fieldId,
        userId: input.userId,
        ownerIds: input.ownerIds,
        slotId: slot.id,
        status: 'BOOKED',
        updatedAt,
      });
    }
  }

  private emitManualPaymentConfirmedEvents(input: {
    bookingId: string;
    paymentId: string;
    attemptId: string;
    venueId: string;
    userId: string;
    ownerIds: string[];
    slots: Array<{ id: string; fieldId: string }>;
  }) {
    const updatedAt = new Date();
    const basePayload = {
      bookingId: input.bookingId,
      venueId: input.venueId,
      userId: input.userId,
      ownerIds: input.ownerIds,
      updatedAt,
    };

    this.realtimeGateway.emitPaymentPaid({
      ...basePayload,
      paymentId: input.paymentId,
      attemptId: input.attemptId,
      status: PaymentStatus.PAID,
      provider: PaymentProvider.MOMO_MANUAL,
      paidAt: updatedAt,
    });

    this.realtimeGateway.emitBookingConfirmed({
      ...basePayload,
      status: BookingStatus.CONFIRMED,
    });

    for (const slot of input.slots) {
      this.realtimeGateway.emitSlotBooked({
        ...basePayload,
        fieldId: slot.fieldId,
        slotId: slot.id,
        status: SlotStatus.BOOKED,
      });
    }
  }

  private async emitBookingCancelledEvents(input: {
    bookingId: string;
    venueId: string;
    userId: string;
    ownerIds: string[];
    slots: Array<{ id: string; fieldId: string }>;
  }) {
    const updatedAt = new Date();
    this.realtimeGateway.emitBookingCancelled({
      bookingId: input.bookingId,
      venueId: input.venueId,
      userId: input.userId,
      ownerIds: input.ownerIds,
      status: BookingStatus.CANCELLED,
      updatedAt,
    });

    for (const slot of input.slots) {
      this.realtimeGateway.emitSlotReleased({
        bookingId: input.bookingId,
        venueId: input.venueId,
        fieldId: slot.fieldId,
        userId: input.userId,
        ownerIds: input.ownerIds,
        slotId: slot.id,
        status: 'AVAILABLE',
        updatedAt,
      });
    }
  }

  private async getVenueOwnerIds(venueId: string) {
    const owners = await this.prisma.venueOwner.findMany({
      where: { venueId, status: 'APPROVED' },
      select: { userId: true },
    });

    return owners.map((owner) => owner.userId);
  }

  private parseDateFilter(date?: string): VietnamDayRange | null {
    if (!date) return null;

    try {
      // Booking date filters are Vietnam business calendar days. Avoid
      // server-local date parsing because production may run in UTC.
      return date === 'today'
        ? getVietnamDayRange()
        : getVietnamDayRangeFromDateString(date);
    } catch {
      throw new BadRequestException('Invalid booking date filter');
    }
  }

  private getBookingStartDate(
    bookingSlots: Array<{ venueSlot: { date: Date; startTime: Date } }>,
  ) {
    const firstSlot = bookingSlots
      .map((bookingSlot) => bookingSlot.venueSlot)
      .sort((a, b) => {
        const dateDiff = a.date.getTime() - b.date.getTime();
        if (dateDiff !== 0) return dateDiff;
        return a.startTime.getTime() - b.startTime.getTime();
      })[0];

    if (!firstSlot) {
      throw new BadRequestException(
        'Booking has no slots to determine its start time',
      );
    }

    return this.getSlotStartDate(firstSlot);
  }

  private getRefundPercent(bookingStart: Date) {
    const hoursUntilStart =
      (bookingStart.getTime() - Date.now()) / (1000 * 60 * 60);

    if (hoursUntilStart > 12) return 100;
    if (hoursUntilStart > 6) return 50;
    return 0;
  }

  private getSlotStartDate(slot: { date: Date; startTime: Date }) {
    return new Date(
      Date.UTC(
        slot.date.getUTCFullYear(),
        slot.date.getUTCMonth(),
        slot.date.getUTCDate(),
        slot.startTime.getUTCHours(),
        slot.startTime.getUTCMinutes(),
        slot.startTime.getUTCSeconds(),
        0,
      ) -
        7 * 60 * 60 * 1000,
    );
  }

  private assertSlotIsFuture(
    slot: { date: Date; startTime: Date },
    now = new Date(),
  ) {
    if (this.getSlotStartDate(slot).getTime() <= now.getTime()) {
      throw new BadRequestException(PAST_SLOT_MESSAGE);
    }
  }

  private isBookingExpired(
    booking: { status: BookingStatus | string; expiresAt?: Date | null },
    now = new Date(),
  ) {
    return (
      booking.status === BookingStatus.PENDING &&
      Boolean(booking.expiresAt) &&
      booking.expiresAt!.getTime() <= now.getTime()
    );
  }

  private async assertBookingStillWithinHold(
    booking: {
      id: string;
      status: BookingStatus | string;
      version: number;
      venueId: string;
      userId: string;
      expiresAt?: Date | null;
      bookingSlots: Array<{
        venueSlot: { id: string; fieldId: string; status: SlotStatus | string };
      }>;
      payment?: {
        id: string;
        provider: PaymentProvider | null;
        status: PaymentStatus;
      } | null;
    },
    now = new Date(),
  ) {
    if (!this.isBookingExpired(booking, now)) {
      return;
    }

    await this.cancelExpiredPendingBooking(booking, now);
    throw new BadRequestException(BOOKING_HOLD_EXPIRED_MESSAGE);
  }

  private async cancelExpiredPendingBooking(
    booking: {
      id: string;
      status: BookingStatus | string;
      version: number;
      venueId: string;
      userId: string;
      bookingSlots: Array<{
        venueSlot: { id: string; fieldId: string; status: SlotStatus | string };
      }>;
      payment?: {
        id: string;
        provider: PaymentProvider | null;
        status: PaymentStatus;
      } | null;
    },
    now: Date,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const bookingUpdate = await tx.booking.updateMany({
        where: {
          id: booking.id,
          version: booking.version,
          status: BookingStatus.PENDING,
        },
        data: {
          status: BookingStatus.CANCELLED,
          cancelledAt: now,
          cancelReason: 'AUTO_EXPIRED',
          version: { increment: 1 },
        },
      });

      if (bookingUpdate.count === 0) {
        return {
          cancelled: false,
          releasedSlots: [] as Array<{ id: string; fieldId: string }>,
        };
      }

      const releasedSlots: Array<{ id: string; fieldId: string }> = [];

      for (const bookingSlot of booking.bookingSlots) {
        if (bookingSlot.venueSlot.status !== SlotStatus.LOCKED) {
          continue;
        }

        const slotUpdate = await tx.venueSlot.updateMany({
          where: {
            id: bookingSlot.venueSlot.id,
            status: SlotStatus.LOCKED,
          },
          data: { status: SlotStatus.AVAILABLE, version: { increment: 1 } },
        });

        if (slotUpdate.count > 0) {
          releasedSlots.push({
            id: bookingSlot.venueSlot.id,
            fieldId: bookingSlot.venueSlot.fieldId,
          });
        }
      }

      if (
        booking.payment?.provider === PaymentProvider.MOMO_MANUAL &&
        booking.payment.status === PaymentStatus.PENDING
      ) {
        await tx.paymentAttempt.updateMany({
          where: {
            paymentId: booking.payment.id,
            provider: PaymentProvider.MOMO_MANUAL,
            status: PaymentAttemptStatus.PENDING,
          },
          data: {
            status: PaymentAttemptStatus.EXPIRED,
            failedAt: now,
            failureCode: 'AUTO_EXPIRED',
            failureMessage:
              'Manual MoMo payment was not confirmed before booking expiration',
          },
        });

        await tx.payment.updateMany({
          where: {
            id: booking.payment.id,
            status: PaymentStatus.PENDING,
          },
          data: {
            status: PaymentStatus.FAILED,
            failedAt: now,
            failureCode: 'AUTO_EXPIRED',
            failureMessage:
              'Manual MoMo payment was not confirmed before booking expiration',
            version: { increment: 1 },
          },
        });
      }

      return { cancelled: true, releasedSlots };
    });

    if (!result.cancelled) {
      return;
    }

    await this.emitBookingCancelledEvents({
      bookingId: booking.id,
      venueId: booking.venueId,
      userId: booking.userId,
      ownerIds: await this.getVenueOwnerIds(booking.venueId),
      slots: result.releasedSlots,
    });
  }
}

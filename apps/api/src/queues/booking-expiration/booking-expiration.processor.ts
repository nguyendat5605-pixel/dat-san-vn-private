import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  PaymentAttemptStatus,
  PaymentProvider,
  PaymentStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RealtimeGateway } from '../../realtime/realtime.gateway.js';

type ExpirationResult =
  | {
      action: 'expired';
      bookingId: string;
      venueId: string;
      userId: string;
      releasedSlots: Array<{ id: string; fieldId: string }>;
      skippedSlots: number;
    }
  | { action: 'skipped'; reason: string };

@Processor('booking-expiration', { concurrency: 5, maxStalledCount: 10 })
export class BookingExpirationProcessor extends WorkerHost {
  private readonly logger = new Logger(BookingExpirationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {
    super();
  }

  async process(job: Job<{ bookingId: string }>): Promise<void> {
    const bookingId = job.data?.bookingId;

    if (typeof bookingId !== 'string' || bookingId.length === 0) {
      throw new Error('Malformed booking expiration job payload: bookingId is required');
    }

    this.logger.log(`Processing expiration job for bookingId: ${bookingId}`);

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        bookingSlots: {
          include: {
            venueSlot: {
              select: { id: true, status: true, version: true },
            },
          },
        },
        payment: { select: { status: true } },
      },
    });

    if (!booking) {
      this.logger.warn(
        `Booking ${bookingId} not found, skipping expiration job.`,
      );
      return;
    }

    if (booking.status !== 'PENDING') {
      this.logger.log(
        `Booking ${bookingId} is in status ${booking.status}, skipping expiration.`,
      );
      return;
    }

    if (booking.payment?.status === PaymentStatus.PAID) {
      this.logger.log(
        `Booking ${bookingId} already has a PAID payment, skipping expiration.`,
      );
      return;
    }

    // Process expiration
    try {
      const result = await this.prisma.$transaction<ExpirationResult>(
        async (tx) => {
          // Re-read current state inside the transaction to avoid false failures
          // when owner confirmation/cancellation commits near the delayed job.
          const currentBooking = await tx.booking.findUnique({
            where: { id: bookingId },
            select: {
              status: true,
              venueId: true,
              userId: true,
              version: true,
              bookingSlots: {
                select: {
                  venueSlot: {
                    select: { id: true, fieldId: true, status: true },
                  },
                },
              },
              payment: {
                select: {
                  id: true,
                  status: true,
                  provider: true,
                  attempts: {
                    where: {
                      provider: PaymentProvider.MOMO_MANUAL,
                      status: PaymentAttemptStatus.PENDING,
                    },
                    select: { id: true },
                  },
                },
              },
            },
          });

          if (!currentBooking) {
            return { action: 'skipped', reason: 'booking no longer exists' };
          }

          if (currentBooking.status !== 'PENDING') {
            return {
              action: 'skipped',
              reason: `booking status is ${currentBooking.status}`,
            };
          }

          if (currentBooking.payment?.status === PaymentStatus.PAID) {
            return {
              action: 'skipped',
              reason: 'booking already has a PAID payment',
            };
          }

          // Update Booking: status = 'CANCELLED', cancelledAt = now(), reason = 'AUTO_EXPIRED'
          const bookingUpdate = await tx.booking.updateMany({
            where: {
              id: bookingId,
              version: currentBooking.version,
              status: 'PENDING',
            },
            data: {
              status: 'CANCELLED',
              cancelledAt: new Date(),
              cancelReason: 'AUTO_EXPIRED',
              version: { increment: 1 },
            },
          });

          if (bookingUpdate.count === 0) {
            const latestBooking = await tx.booking.findUnique({
              where: { id: bookingId },
              select: { status: true },
            });

            if (!latestBooking) {
              return { action: 'skipped', reason: 'booking no longer exists' };
            }

            if (latestBooking.status !== 'PENDING') {
              return {
                action: 'skipped',
                reason: `booking changed to ${latestBooking.status}`,
              };
            }

            throw new Error(
              `Booking ${bookingId} remained PENDING after expiration update conflict`,
            );
          }

          const releasedSlots: Array<{ id: string; fieldId: string }> = [];
          let skippedSlots = 0;

          // Release only slots that are still LOCKED. If another valid state
          // transition already changed a slot, treat that as an expected race.
          for (const bs of currentBooking.bookingSlots) {
            if (bs.venueSlot.status !== 'LOCKED') {
              skippedSlots += 1;
              this.logger.log(
                `Skipping slot ${bs.venueSlot.id} for booking ${bookingId}: status is ${bs.venueSlot.status}, not LOCKED.`,
              );
              continue;
            }

            const slotUpdate = await tx.venueSlot.updateMany({
              where: {
                id: bs.venueSlot.id,
                status: 'LOCKED',
              },
              data: { status: 'AVAILABLE', version: { increment: 1 } },
            });

            if (slotUpdate.count === 0) {
              const latestSlot = await tx.venueSlot.findUnique({
                where: { id: bs.venueSlot.id },
                select: { status: true },
              });

              if (!latestSlot || latestSlot.status !== 'LOCKED') {
                skippedSlots += 1;
                this.logger.log(
                  `Skipping slot ${bs.venueSlot.id} for booking ${bookingId}: slot changed before release.`,
                );
                continue;
              }

              throw new Error(
                `Slot ${bs.venueSlot.id} remained LOCKED after release update conflict`,
              );
            }

            releasedSlots.push({
              id: bs.venueSlot.id,
              fieldId: bs.venueSlot.fieldId,
            });
          }

          if (
            currentBooking.payment?.provider === PaymentProvider.MOMO_MANUAL &&
            currentBooking.payment.status === PaymentStatus.PENDING
          ) {
            const now = new Date();

            await tx.paymentAttempt.updateMany({
              where: {
                paymentId: currentBooking.payment.id,
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
                id: currentBooking.payment.id,
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

          return {
            action: 'expired',
            bookingId,
            venueId: currentBooking.venueId,
            userId: currentBooking.userId,
            releasedSlots,
            skippedSlots,
          };
        },
      );

      if (result.action === 'skipped') {
        this.logger.log(
          `Booking ${bookingId} expiration job completed without changes: ${result.reason}.`,
        );
        return;
      }

      this.logger.log(
        `Booking ${bookingId} successfully auto-expired. Released slots: ${result.releasedSlots.length}, skipped slots: ${result.skippedSlots}.`,
      );
      await this.emitExpirationEvents(result);
    } catch (error) {
      this.logger.error(
        `Failed to execute expiration transaction for bookingId: ${bookingId}`,
        error,
      );
      throw error; // Let BullMQ retry
    }
  }

  private async emitExpirationEvents(
    result: Extract<ExpirationResult, { action: 'expired' }>,
  ) {
    const ownerIds = await this.getVenueOwnerIds(result.venueId);
    const updatedAt = new Date();

    this.realtimeGateway.emitBookingCancelled({
      bookingId: result.bookingId,
      venueId: result.venueId,
      userId: result.userId,
      ownerIds,
      status: 'CANCELLED',
      updatedAt,
    });

    for (const slot of result.releasedSlots) {
      this.realtimeGateway.emitSlotReleased({
        bookingId: result.bookingId,
        venueId: result.venueId,
        fieldId: slot.fieldId,
        userId: result.userId,
        ownerIds,
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
}

import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  NotImplementedException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  BookingStatus,
  PaymentAttemptStatus,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  PaymentWebhookProcessingStatus,
  Prisma,
  SlotStatus,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { success } from '../common/helpers/api-response.helper.js';
import { PaymentConfig } from './payment.config.js';
import { PaymentInitiationIdempotencyService } from './payment-initiation-idempotency.service.js';
import { MomoPaymentProvider } from './providers/momo-payment.provider.js';
import { PaymentProviderRegistry } from './providers/payment-provider.registry.js';
import { VnpayPaymentProvider } from './providers/vnpay-payment.provider.js';
import type { CreatePaymentDto } from './dto/index.js';
import type { VerifiedPaymentWebhookResult } from './types/payment-provider.types.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { resolvePaymentHoldMinutes } from '../queues/booking-expiration/booking-expiration.constants.js';

const DEFAULT_CURRENCY = 'VND';

type PreparedPaymentAttempt =
  | {
      type: 'reused';
      paymentId: string;
      attemptId: string;
      bookingId: string;
      provider: PaymentProvider;
      amount: number;
      currency: string;
      paymentUrl: string | null;
      status: PaymentAttemptStatus;
      expiresAt: Date | null;
      rawCreateResponse?: Prisma.JsonValue | Prisma.InputJsonObject | null;
    }
  | {
      type: 'created';
      paymentId: string;
      attemptId: string;
      bookingId: string;
      provider: PaymentProvider;
      amount: number;
      currency: string;
      providerOrderId: string;
      providerRequestId: string;
      returnUrl: string;
      webhookUrl: string;
      expiresAt: Date;
    };

type PersistWebhookEventResult = {
  type: 'created' | 'duplicate';
  eventId: string;
  processingStatus: PaymentWebhookProcessingStatus;
};

type PaymentFinalizationAttempt = Prisma.PaymentAttemptGetPayload<{
  include: {
    payment: {
      include: {
        booking: {
          include: {
            bookingSlots: {
              include: {
                venueSlot: true;
              };
            };
          };
        };
      };
    };
  };
}>;

type PaymentFinalizationResult =
  | { type: 'finalized' }
  | { type: 'already_finalized' }
  | { type: 'requires_reconciliation'; reason: string };

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly paymentConfig: PaymentConfig,
    private readonly providerRegistry: PaymentProviderRegistry,
    private readonly paymentIdempotencyService: PaymentInitiationIdempotencyService,
    private readonly momoPaymentProvider: MomoPaymentProvider,
    private readonly vnpayPaymentProvider: VnpayPaymentProvider,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  async createPaymentForBooking(
    userId: string,
    dto: CreatePaymentDto,
    idempotencyKey?: string,
    clientIp?: string,
  ) {
    const idempotency = await this.paymentIdempotencyService.startOrGet(
      userId,
      dto,
      idempotencyKey,
    );

    if (idempotency.type === 'succeeded') {
      return idempotency.response;
    }

    if (idempotency.type === 'payload_conflict') {
      throw new ConflictException(
        'Idempotency-Key was already used with a different payment payload',
      );
    }

    if (idempotency.type === 'in_progress') {
      throw new ConflictException('PAYMENT_INITIATION_IN_PROGRESS');
    }

    if (idempotency.type === 'unavailable') {
      return this.createPaymentForBookingOnce(userId, dto, undefined, clientIp);
    }

    try {
      const response = await this.createPaymentForBookingOnce(
        userId,
        dto,
        idempotency.context,
        clientIp,
      );
      await this.paymentIdempotencyService.saveSuccess(
        idempotency.context,
        response,
        response.data.expiresAt,
      );

      return response;
    } catch (error) {
      await this.paymentIdempotencyService.clear(idempotency.context);
      throw error;
    }
  }

  private async createPaymentForBookingOnce(
    userId: string,
    dto: CreatePaymentDto,
    idempotencyContext?: {
      cacheKey: string;
      payloadHash: string;
    },
    clientIp?: string,
  ) {
    const providerService = this.providerRegistry.getProvider(dto.provider);
    const prepared = await this.preparePaymentAttempt(userId, dto);

    if (idempotencyContext) {
      await this.paymentIdempotencyService.refreshProcessingTtl(
        idempotencyContext,
        prepared.expiresAt,
      );
    }

    if (prepared.type === 'reused') {
      return this.buildPaymentInitiationResponse(
        prepared,
        'Existing payment attempt reused successfully',
      );
    }

    let providerResult: Awaited<
      ReturnType<typeof providerService.createPaymentAttempt>
    >;

    try {
      providerResult = await providerService.createPaymentAttempt({
        provider: prepared.provider,
        bookingId: prepared.bookingId,
        paymentId: prepared.paymentId,
        attemptId: prepared.attemptId,
        amount: prepared.amount,
        currency: prepared.currency,
        providerOrderId: prepared.providerOrderId,
        providerRequestId: prepared.providerRequestId,
        returnUrl: prepared.returnUrl,
        webhookUrl: prepared.webhookUrl,
        clientIp,
      });
    } catch (error) {
      await this.markProviderCreationFailed(prepared, error);
      if (idempotencyContext) {
        await this.paymentIdempotencyService.clear(idempotencyContext);
      }
      throw new BadGatewayException(
        'Payment provider could not create payment attempt',
      );
    }

    const finalized = await this.finalizeProviderCreation(
      prepared,
      providerResult,
    );

    if (finalized.provider === PaymentProvider.MOMO_MANUAL) {
      await this.emitManualPaymentPendingEvents(finalized.bookingId);
    }

    return this.buildPaymentInitiationResponse(
      finalized,
      'Payment attempt created successfully',
    );
  }

  async getPaymentStatusForBooking(userId: string, bookingId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, userId },
      select: {
        id: true,
        status: true,
        totalPrice: true,
        payment: {
          include: {
            attempts: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const latestAttempt = booking.payment?.attempts[0] ?? null;

    return success(
      {
        bookingId: booking.id,
        bookingStatus: booking.status,
        totalPrice: Number(booking.totalPrice),
        payment: booking.payment
          ? {
              id: booking.payment.id,
              status: booking.payment.status,
              method: booking.payment.method,
              provider: booking.payment.provider,
              amount: Number(booking.payment.amount),
              currency: booking.payment.currency,
              paidAt: booking.payment.paidAt,
              failedAt: booking.payment.failedAt,
              expiresAt: booking.payment.expiresAt,
              latestAttempt: latestAttempt
                ? {
                    id: latestAttempt.id,
                    provider: latestAttempt.provider,
                    status: latestAttempt.status,
                    amount: Number(latestAttempt.amount),
                    currency: latestAttempt.currency,
                    paymentUrl: latestAttempt.paymentUrl,
                    expiresAt: latestAttempt.expiresAt,
                    createdAt: latestAttempt.createdAt,
                  }
                : null,
            }
          : null,
      },
      'Payment status retrieved successfully',
    );
  }

  async completeMockPaymentAttempt(userId: string, attemptId: string) {
    this.assertMockPaymentCompletionEnabled();

    const result = await this.prisma.$transaction(async (tx) => {
      const attempt = await tx.paymentAttempt.findUnique({
        where: { id: attemptId },
        include: {
          payment: {
            include: {
              booking: {
                include: {
                  bookingSlots: {
                    include: {
                      venueSlot: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!attempt || attempt.payment.userId !== userId) {
        throw new NotFoundException('Payment attempt not found');
      }

      if (!this.isMockPaymentAttempt(attempt)) {
        throw new BadRequestException(
          'Payment attempt is not a local mock payment attempt',
        );
      }

      const finalization = await this.finalizeSuccessfulPaymentAttempt(
        tx,
        attempt,
        {
          expectedProvider: attempt.provider,
          providerTransactionId: `MOCK-${attempt.id}`,
        },
      );

      if (finalization.type === 'requires_reconciliation') {
        throw new ConflictException(finalization.reason);
      }

      return {
        finalization,
        attemptId: attempt.id,
        paymentId: attempt.paymentId,
        bookingId: attempt.payment.bookingId,
        provider: attempt.provider,
      };
    });

    return success(
      {
        attemptId: result.attemptId,
        paymentId: result.paymentId,
        bookingId: result.bookingId,
        provider: result.provider,
        finalizationStatus: result.finalization.type,
      },
      result.finalization.type === 'already_finalized'
        ? 'Mock payment was already completed'
        : 'Mock payment completed successfully',
    );
  }

  async processPaymentWebhook(
    provider: PaymentProvider,
    rawBody: Buffer,
    body: unknown,
    headers: Record<string, string | string[] | undefined>,
    query: Record<string, string | string[] | undefined> = {},
  ) {
    if (provider === PaymentProvider.VNPAY) {
      return this.processVnpayPaymentWebhook(rawBody, body, headers, query);
    }

    if (provider !== PaymentProvider.MOMO) {
      throw new NotImplementedException(
        `${provider} webhook processing is not implemented`,
      );
    }

    const verified = await this.momoPaymentProvider.verifyWebhook({
      provider,
      rawBody,
      body,
      headers,
    });

    if (!verified.valid) {
      await this.persistWebhookEvent({
        verified,
        processingStatus: PaymentWebhookProcessingStatus.INVALID_SIGNATURE,
        signatureVerified: false,
      });
      this.logger.warn(
        `Rejected MoMo IPN invalid_signature orderId=${verified.providerOrderId || 'unknown'} requestId=${verified.providerRequestId ?? 'unknown'} resultCode=${verified.resultCode ?? 'unknown'}`,
      );
      throw new UnauthorizedException('Invalid payment webhook signature');
    }

    const attempt = await this.prisma.paymentAttempt.findFirst({
      where: {
        provider: PaymentProvider.MOMO,
        OR: [
          { providerOrderId: verified.providerOrderId },
          ...(verified.providerRequestId
            ? [{ providerRequestId: verified.providerRequestId }]
            : []),
        ],
      },
      include: {
        payment: {
          include: {
            booking: {
              include: {
                bookingSlots: {
                  include: {
                    venueSlot: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!attempt) {
      await this.persistWebhookEvent({
        verified,
        processingStatus: PaymentWebhookProcessingStatus.FAILED,
        signatureVerified: true,
      });
      this.logger.warn(
        `Rejected MoMo IPN unknown_attempt orderId=${verified.providerOrderId} requestId=${verified.providerRequestId ?? 'unknown'} resultCode=${verified.resultCode ?? 'unknown'}`,
      );
      throw new BadRequestException('Payment attempt not found for webhook');
    }

    if (
      verified.partnerCode !==
      this.paymentConfig.getMomoSandboxConfig().partnerCode
    ) {
      await this.persistWebhookEvent({
        verified,
        attemptId: attempt.id,
        processingStatus: PaymentWebhookProcessingStatus.FAILED,
        signatureVerified: true,
      });
      this.logger.warn(
        `Rejected MoMo IPN partner_mismatch attemptId=${attempt.id} orderId=${verified.providerOrderId}`,
      );
      throw new BadRequestException('Payment webhook partner mismatch');
    }

    if (attempt.provider !== PaymentProvider.MOMO) {
      await this.persistWebhookEvent({
        verified,
        attemptId: attempt.id,
        processingStatus: PaymentWebhookProcessingStatus.FAILED,
        signatureVerified: true,
      });
      throw new BadRequestException('Payment webhook provider mismatch');
    }

    if (!this.webhookAmountMatches(verified, attempt)) {
      await this.persistWebhookEvent({
        verified,
        attemptId: attempt.id,
        processingStatus: PaymentWebhookProcessingStatus.AMOUNT_MISMATCH,
        signatureVerified: true,
      });
      this.logger.warn(
        `Rejected MoMo IPN amount_mismatch attemptId=${attempt.id} orderId=${verified.providerOrderId}`,
      );
      throw new BadRequestException('Payment webhook amount mismatch');
    }

    const processingStatus =
      verified.resultCode === 0
        ? PaymentWebhookProcessingStatus.RECEIVED
        : verified.resultCode === 9000
          ? PaymentWebhookProcessingStatus.PROCESSED
          : PaymentWebhookProcessingStatus.IGNORED;
    const persistedEvent = await this.persistWebhookEvent({
      verified,
      attemptId: attempt.id,
      processingStatus,
      signatureVerified: true,
    });

    if (verified.resultCode === 0) {
      await this.finalizeSuccessfulMomoWebhook(
        verified,
        persistedEvent.eventId,
      );
    }

    this.logger.log(
      `Accepted MoMo IPN status=${persistedEvent.type} attemptId=${attempt.id} orderId=${verified.providerOrderId} requestId=${verified.providerRequestId ?? 'unknown'} resultCode=${verified.resultCode ?? 'unknown'} processingStatus=${processingStatus}`,
    );
  }

  private async processVnpayPaymentWebhook(
    rawBody: Buffer,
    body: unknown,
    headers: Record<string, string | string[] | undefined>,
    query: Record<string, string | string[] | undefined>,
  ) {
    const verified = await this.vnpayPaymentProvider.verifyWebhook({
      provider: PaymentProvider.VNPAY,
      rawBody,
      body,
      headers,
      query,
    });

    if (!verified.valid) {
      this.logger.warn(
        `Rejected VNPay callback invalid_signature txnRef=${verified.providerOrderId || 'unknown'} responseCode=${verified.resultCode ?? 'unknown'}`,
      );
      return this.buildVnpayIpnResponse('97', 'Invalid signature');
    }

    const attempt = await this.prisma.paymentAttempt.findFirst({
      where: {
        provider: PaymentProvider.VNPAY,
        providerOrderId: verified.providerOrderId,
      },
      include: {
        payment: {
          include: {
            booking: {
              include: {
                bookingSlots: {
                  include: {
                    venueSlot: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!attempt) {
      this.logger.warn(
        `Rejected VNPay callback unknown_attempt txnRef=${verified.providerOrderId} responseCode=${verified.resultCode ?? 'unknown'}`,
      );
      return this.buildVnpayIpnResponse('01', 'Order not found');
    }

    if (
      verified.partnerCode !==
      this.paymentConfig.getVnpaySandboxConfig().tmnCode
    ) {
      this.logger.warn(
        `Rejected VNPay callback tmn_mismatch attemptId=${attempt.id} txnRef=${verified.providerOrderId}`,
      );
      return this.buildVnpayIpnResponse('97', 'Invalid signature');
    }

    if (!this.webhookAmountMatches(verified, attempt)) {
      await this.persistWebhookEvent({
        verified,
        attemptId: attempt.id,
        processingStatus: PaymentWebhookProcessingStatus.AMOUNT_MISMATCH,
        signatureVerified: true,
      });
      this.logger.warn(
        `Rejected VNPay callback amount_mismatch attemptId=${attempt.id} txnRef=${verified.providerOrderId}`,
      );
      return this.buildVnpayIpnResponse('04', 'Invalid amount');
    }

    const persistedEvent = await this.persistWebhookEvent({
      verified,
      attemptId: attempt.id,
      processingStatus: verified.isSuccess
        ? PaymentWebhookProcessingStatus.RECEIVED
        : PaymentWebhookProcessingStatus.IGNORED,
      signatureVerified: true,
    });

    if (verified.isSuccess) {
      const result = await this.finalizeSuccessfulVnpayWebhook(
        verified,
        persistedEvent.eventId,
      );

      if (result === 'requires_reconciliation') {
        return this.buildVnpayIpnResponse('99', 'Confirm failed');
      }

      if (result === 'finalized') {
        await this.emitPaymentSuccessEvents(verified, PaymentProvider.VNPAY);
      }

      this.logger.log(
        `Accepted VNPay success callback status=${persistedEvent.type} attemptId=${attempt.id} txnRef=${verified.providerOrderId} transactionNo=${verified.providerTransactionId ?? 'unknown'}`,
      );
      return this.buildVnpayIpnResponse('00', 'Confirm Success');
    }

    await this.markFailedVnpayPaymentAttempt(
      verified,
      persistedEvent.eventId,
      attempt,
    );
    this.logger.log(
      `Accepted VNPay failed callback status=${persistedEvent.type} attemptId=${attempt.id} txnRef=${verified.providerOrderId} responseCode=${verified.resultCode ?? 'unknown'}`,
    );
    return this.buildVnpayIpnResponse('00', 'Confirm Success');
  }

  private async preparePaymentAttempt(
    userId: string,
    dto: CreatePaymentDto,
  ): Promise<PreparedPaymentAttempt> {
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findFirst({
        where: { id: dto.bookingId, userId },
        include: {
          bookingSlots: {
            include: {
              venueSlot: {
                select: { id: true, status: true },
              },
            },
          },
        },
      });

      if (!booking) {
        throw new NotFoundException('Booking not found');
      }

      if (booking.status !== BookingStatus.PENDING) {
        throw new ConflictException(
          `Booking is ${booking.status} and cannot be paid`,
        );
      }

      if (booking.bookingSlots.length === 0) {
        throw new ConflictException('Booking has no locked slots to pay for');
      }

      const unlockedSlot = booking.bookingSlots.find(
        (bookingSlot) => bookingSlot.venueSlot.status !== SlotStatus.LOCKED,
      );

      if (unlockedSlot) {
        throw new ConflictException(
          'Booking slot is no longer locked and cannot be paid',
        );
      }

      const amount = Number(booking.totalPrice);
      const expiresAt = this.resolveAttemptExpiresAt(
        booking.expiresAt,
        booking.createdAt,
      );

      if (expiresAt.getTime() <= now.getTime()) {
        throw new ConflictException('Booking payment window has expired');
      }

      const payment = await this.getOrCreatePaymentAggregate(tx, {
        bookingId: booking.id,
        userId,
        amount: booking.totalPrice,
        provider: dto.provider,
        expiresAt,
      });

      const inFlightAttempt = await tx.paymentAttempt.findFirst({
        where: {
          paymentId: payment.id,
          provider: dto.provider,
          status: {
            in: [PaymentAttemptStatus.PENDING, PaymentAttemptStatus.PROCESSING],
          },
          expiresAt: { gt: now },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (
        inFlightAttempt?.paymentUrl ||
        (inFlightAttempt && dto.provider === PaymentProvider.MOMO_MANUAL)
      ) {
        return {
          type: 'reused',
          paymentId: payment.id,
          attemptId: inFlightAttempt.id,
          bookingId: booking.id,
          provider: inFlightAttempt.provider,
          amount: Number(inFlightAttempt.amount),
          currency: inFlightAttempt.currency,
          paymentUrl: inFlightAttempt.paymentUrl,
          status: inFlightAttempt.status,
          expiresAt: inFlightAttempt.expiresAt,
          rawCreateResponse: inFlightAttempt.rawCreateResponse,
        };
      }

      if (inFlightAttempt) {
        throw new ConflictException('PAYMENT_ATTEMPT_IN_PROGRESS');
      }

      const attempt = await tx.paymentAttempt.create({
        data: {
          paymentId: payment.id,
          provider: dto.provider,
          status: PaymentAttemptStatus.PENDING,
          amount: booking.totalPrice,
          currency: DEFAULT_CURRENCY,
          providerOrderId: this.createProviderOrderId(dto.provider),
          providerRequestId: this.createProviderRequestId(dto.provider),
          expiresAt,
        },
      });

      return {
        type: 'created',
        paymentId: payment.id,
        attemptId: attempt.id,
        bookingId: booking.id,
        provider: dto.provider,
        amount,
        currency: attempt.currency,
        providerOrderId: attempt.providerOrderId,
        providerRequestId: attempt.providerRequestId ?? '',
        returnUrl: this.buildReturnUrl(dto.provider, booking.id),
        webhookUrl: this.buildWebhookUrl(dto.provider),
        expiresAt,
      };
    });
  }

  private async finalizeProviderCreation(
    prepared: Extract<PreparedPaymentAttempt, { type: 'created' }>,
    providerResult: Awaited<
      ReturnType<
        ReturnType<
          PaymentProviderRegistry['getProvider']
        >['createPaymentAttempt']
      >
    >,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const attempt = await tx.paymentAttempt.update({
        where: { id: prepared.attemptId },
        data: {
          status:
            prepared.provider === PaymentProvider.MOMO_MANUAL
              ? PaymentAttemptStatus.PENDING
              : PaymentAttemptStatus.PROCESSING,
          paymentUrl: providerResult.paymentUrl,
          rawCreateResponse: providerResult.rawProviderResponse,
        },
      });

      await tx.payment.update({
        where: { id: prepared.paymentId },
        data: {
          status: PaymentStatus.PENDING,
          provider: prepared.provider,
          method: this.toPaymentMethod(prepared.provider),
          expiresAt: prepared.expiresAt,
          failedAt: null,
          failureCode: null,
          failureMessage: null,
          version: { increment: 1 },
        },
      });

      return {
        type: 'reused' as const,
        paymentId: prepared.paymentId,
        attemptId: attempt.id,
        bookingId: prepared.bookingId,
        provider: attempt.provider,
        amount: Number(attempt.amount),
        currency: attempt.currency,
        paymentUrl: attempt.paymentUrl ?? providerResult.paymentUrl ?? null,
        status: attempt.status,
        expiresAt: attempt.expiresAt,
        rawCreateResponse: providerResult.rawProviderResponse,
      };
    });
  }

  private async markProviderCreationFailed(
    prepared: Extract<PreparedPaymentAttempt, { type: 'created' }>,
    error: unknown,
  ) {
    const failureMessage = this.getErrorMessage(error);

    await this.prisma.$transaction(async (tx) => {
      await tx.paymentAttempt.update({
        where: { id: prepared.attemptId },
        data: {
          status: PaymentAttemptStatus.FAILED,
          failedAt: new Date(),
          failureCode: 'PROVIDER_CREATE_FAILED',
          failureMessage,
          rawCreateResponse: this.serializeProviderError(error),
        },
      });

      await tx.payment.update({
        where: { id: prepared.paymentId },
        data: {
          status: PaymentStatus.FAILED,
          failedAt: new Date(),
          failureCode: 'PROVIDER_CREATE_FAILED',
          failureMessage,
          version: { increment: 1 },
        },
      });
    });
  }

  private async finalizeSuccessfulMomoWebhook(
    verified: VerifiedPaymentWebhookResult,
    eventId: string,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const attempt = await tx.paymentAttempt.findFirst({
        where: {
          provider: PaymentProvider.MOMO,
          OR: [
            { providerOrderId: verified.providerOrderId },
            ...(verified.providerRequestId
              ? [{ providerRequestId: verified.providerRequestId }]
              : []),
          ],
        },
        include: {
          payment: {
            include: {
              booking: {
                include: {
                  bookingSlots: {
                    include: {
                      venueSlot: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!attempt) {
        await tx.paymentWebhookEvent.update({
          where: { id: eventId },
          data: {
            processingStatus: PaymentWebhookProcessingStatus.FAILED,
            processedAt: new Date(),
          },
        });

        return 'unknown_attempt' as const;
      }

      if (this.isAlreadyFinalized(attempt)) {
        await tx.paymentWebhookEvent.update({
          where: { id: eventId },
          data: {
            attemptId: attempt.id,
            processingStatus: PaymentWebhookProcessingStatus.PROCESSED,
            processedAt: new Date(),
          },
        });

        return 'already_finalized' as const;
      }

      const finalization = await this.finalizeSuccessfulPaymentAttempt(
        tx,
        attempt,
        {
          expectedProvider: PaymentProvider.MOMO,
          providerTransactionId: verified.providerTransactionId,
        },
      );

      if (finalization.type === 'already_finalized') {
        await tx.paymentWebhookEvent.update({
          where: { id: eventId },
          data: {
            attemptId: attempt.id,
            processingStatus: PaymentWebhookProcessingStatus.PROCESSED,
            processedAt: new Date(),
          },
        });

        return 'already_finalized' as const;
      }

      if (finalization.type === 'requires_reconciliation') {
        await this.markMomoWebhookRequiresReconciliation(
          tx,
          verified,
          attempt,
          eventId,
          finalization.reason,
        );

        return 'requires_reconciliation' as const;
      }

      const now = new Date();

      await tx.paymentWebhookEvent.update({
        where: { id: eventId },
        data: {
          attemptId: attempt.id,
          processingStatus: PaymentWebhookProcessingStatus.PROCESSED,
          processedAt: now,
        },
      });

      return 'finalized' as const;
    });

    if (result === 'requires_reconciliation') {
      this.logger.warn(
        `MoMo IPN requires reconciliation orderId=${verified.providerOrderId} requestId=${verified.providerRequestId ?? 'unknown'} transId=${verified.providerTransactionId ?? 'unknown'}`,
      );
    }

    if (result === 'finalized') {
      await this.emitPaymentSuccessEvents(verified, PaymentProvider.MOMO);
    }
  }

  private async finalizeSuccessfulVnpayWebhook(
    verified: VerifiedPaymentWebhookResult,
    eventId: string,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const attempt = await tx.paymentAttempt.findFirst({
        where: {
          provider: PaymentProvider.VNPAY,
          providerOrderId: verified.providerOrderId,
        },
        include: {
          payment: {
            include: {
              booking: {
                include: {
                  bookingSlots: {
                    include: {
                      venueSlot: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!attempt) {
        await tx.paymentWebhookEvent.update({
          where: { id: eventId },
          data: {
            processingStatus: PaymentWebhookProcessingStatus.FAILED,
            processedAt: new Date(),
          },
        });

        return 'unknown_attempt' as const;
      }

      if (this.isAlreadyFinalized(attempt)) {
        await tx.paymentWebhookEvent.update({
          where: { id: eventId },
          data: {
            attemptId: attempt.id,
            processingStatus: PaymentWebhookProcessingStatus.PROCESSED,
            processedAt: new Date(),
          },
        });

        return 'already_finalized' as const;
      }

      const finalization = await this.finalizeSuccessfulPaymentAttempt(
        tx,
        attempt,
        {
          expectedProvider: PaymentProvider.VNPAY,
          providerTransactionId: verified.providerTransactionId,
        },
      );

      if (finalization.type === 'already_finalized') {
        await tx.paymentWebhookEvent.update({
          where: { id: eventId },
          data: {
            attemptId: attempt.id,
            processingStatus: PaymentWebhookProcessingStatus.PROCESSED,
            processedAt: new Date(),
          },
        });

        return 'already_finalized' as const;
      }

      if (finalization.type === 'requires_reconciliation') {
        await this.markVnpayWebhookRequiresReconciliation(
          tx,
          verified,
          attempt,
          eventId,
          finalization.reason,
        );

        return 'requires_reconciliation' as const;
      }

      await tx.paymentWebhookEvent.update({
        where: { id: eventId },
        data: {
          attemptId: attempt.id,
          processingStatus: PaymentWebhookProcessingStatus.PROCESSED,
          processedAt: new Date(),
        },
      });

      return 'finalized' as const;
    });

    if (result === 'requires_reconciliation') {
      this.logger.warn(
        `VNPay callback requires reconciliation txnRef=${verified.providerOrderId} transactionNo=${verified.providerTransactionId ?? 'unknown'}`,
      );
    }

    return result;
  }

  private async emitPaymentSuccessEvents(
    verified: VerifiedPaymentWebhookResult,
    provider: PaymentProvider,
  ) {
    const attempt = await this.prisma.paymentAttempt.findFirst({
      where: {
        provider,
        providerOrderId: verified.providerOrderId,
      },
      include: {
        payment: {
          include: {
            booking: {
              include: {
                bookingSlots: {
                  include: {
                    venueSlot: {
                      select: { id: true, fieldId: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!attempt) {
      return;
    }

    const booking = attempt.payment.booking;
    const ownerIds = await this.getVenueOwnerIds(booking.venueId);
    const updatedAt = new Date();
    const basePayload = {
      bookingId: booking.id,
      venueId: booking.venueId,
      userId: booking.userId,
      ownerIds,
      updatedAt,
    };

    this.realtimeGateway.emitPaymentPaid({
      ...basePayload,
      paymentId: attempt.paymentId,
      attemptId: attempt.id,
      status: PaymentStatus.PAID,
      provider,
      paidAt: attempt.paidAt,
    });

    this.realtimeGateway.emitBookingConfirmed({
      ...basePayload,
      status: BookingStatus.CONFIRMED,
    });

    for (const bookingSlot of booking.bookingSlots) {
      this.realtimeGateway.emitSlotBooked({
        ...basePayload,
        fieldId: bookingSlot.venueSlot.fieldId,
        slotId: bookingSlot.venueSlot.id,
        status: SlotStatus.BOOKED,
      });
    }
  }

  private async emitManualPaymentPendingEvents(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        bookingSlots: {
          include: {
            venueSlot: {
              select: { id: true, fieldId: true, status: true },
            },
          },
        },
      },
    });

    if (!booking) {
      return;
    }

    const ownerIds = await this.getVenueOwnerIds(booking.venueId);
    const updatedAt = new Date();

    this.realtimeGateway.emitBookingCreated({
      bookingId: booking.id,
      venueId: booking.venueId,
      userId: booking.userId,
      ownerIds,
      status: booking.status,
      totalPrice: Number(booking.totalPrice),
      expiresAt: booking.expiresAt,
      updatedAt,
    });

    for (const bookingSlot of booking.bookingSlots) {
      if (bookingSlot.venueSlot.status !== SlotStatus.LOCKED) {
        continue;
      }

      this.realtimeGateway.emitSlotLocked({
        bookingId: booking.id,
        venueId: booking.venueId,
        fieldId: bookingSlot.venueSlot.fieldId,
        userId: booking.userId,
        ownerIds,
        slotId: bookingSlot.venueSlot.id,
        status: SlotStatus.LOCKED,
        updatedAt,
      });
    }
  }

  private async markFailedVnpayPaymentAttempt(
    verified: VerifiedPaymentWebhookResult,
    eventId: string,
    attempt: PaymentFinalizationAttempt,
  ) {
    const now = new Date();
    const failureCode = `VNPAY_${verified.resultCode ?? 'FAILED'}`;
    const failureMessage = verified.message ?? 'VNPay reported failed payment';

    await this.prisma.$transaction(async (tx) => {
      await tx.paymentAttempt.updateMany({
        where: {
          id: attempt.id,
          status: {
            in: [PaymentAttemptStatus.PENDING, PaymentAttemptStatus.PROCESSING],
          },
        },
        data: {
          status: PaymentAttemptStatus.FAILED,
          providerTransactionId:
            verified.providerTransactionId ?? attempt.providerTransactionId,
          failedAt: now,
          failureCode,
          failureMessage,
        },
      });

      await tx.payment.updateMany({
        where: {
          id: attempt.paymentId,
          status: PaymentStatus.PENDING,
        },
        data: {
          status: PaymentStatus.FAILED,
          transactionId:
            verified.providerTransactionId ?? attempt.providerTransactionId,
          failedAt: now,
          failureCode,
          failureMessage,
          version: { increment: 1 },
        },
      });

      await tx.paymentWebhookEvent.update({
        where: { id: eventId },
        data: {
          attemptId: attempt.id,
          processingStatus: PaymentWebhookProcessingStatus.PROCESSED,
          processedAt: now,
        },
      });
    });
  }

  private async persistWebhookEvent(input: {
    verified: VerifiedPaymentWebhookResult;
    attemptId?: string;
    processingStatus: PaymentWebhookProcessingStatus;
    signatureVerified: boolean;
  }): Promise<PersistWebhookEventResult> {
    try {
      const event = await this.prisma.paymentWebhookEvent.create({
        data: {
          attemptId: input.attemptId,
          provider: input.verified.provider,
          providerOrderId: input.verified.providerOrderId || null,
          providerTransactionId: input.verified.providerTransactionId || null,
          providerEventId: input.verified.providerEventId || null,
          payloadHash: input.verified.payloadHash,
          signatureVerified: input.signatureVerified,
          processingStatus: input.processingStatus,
          rawPayload: input.verified.rawPayload,
          processedAt:
            input.processingStatus === PaymentWebhookProcessingStatus.RECEIVED
              ? null
              : new Date(),
        },
      });

      return {
        type: 'created',
        eventId: event.id,
        processingStatus: event.processingStatus,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existingEvent = await this.prisma.paymentWebhookEvent.findUnique({
          where: { payloadHash: input.verified.payloadHash },
          select: { id: true, processingStatus: true },
        });

        if (!existingEvent) {
          throw error;
        }

        return {
          type: 'duplicate',
          eventId: existingEvent.id,
          processingStatus: existingEvent.processingStatus,
        };
      }

      throw error;
    }
  }

  private async finalizeSuccessfulPaymentAttempt(
    tx: Prisma.TransactionClient,
    attempt: PaymentFinalizationAttempt,
    input: {
      expectedProvider: PaymentProvider;
      providerTransactionId?: string | null;
    },
  ): Promise<PaymentFinalizationResult> {
    if (this.isAlreadyFinalized(attempt)) {
      return { type: 'already_finalized' };
    }

    const reconciliationReason = this.getPaymentFinalizationBlockReason(
      attempt,
      input.expectedProvider,
    );

    if (reconciliationReason) {
      return { type: 'requires_reconciliation', reason: reconciliationReason };
    }

    const now = new Date();
    const slotIds = attempt.payment.booking.bookingSlots.map(
      (bookingSlot) => bookingSlot.venueSlotId,
    );

    const attemptUpdate = await tx.paymentAttempt.updateMany({
      where: {
        id: attempt.id,
        provider: input.expectedProvider,
        status: {
          in: [PaymentAttemptStatus.PENDING, PaymentAttemptStatus.PROCESSING],
        },
      },
      data: {
        status: PaymentAttemptStatus.PAID,
        providerTransactionId:
          input.providerTransactionId ?? attempt.providerTransactionId,
        paidAt: now,
        failedAt: null,
        failureCode: null,
        failureMessage: null,
      },
    });

    if (attemptUpdate.count !== 1) {
      throw new Error(
        'Payment finalization race: payment attempt update lost guard',
      );
    }

    const paymentUpdate = await tx.payment.updateMany({
      where: {
        id: attempt.paymentId,
        status: PaymentStatus.PENDING,
        provider: input.expectedProvider,
      },
      data: {
        status: PaymentStatus.PAID,
        transactionId:
          input.providerTransactionId ?? attempt.providerTransactionId,
        paidAt: now,
        failedAt: null,
        failureCode: null,
        failureMessage: null,
        version: { increment: 1 },
      },
    });

    if (paymentUpdate.count !== 1) {
      throw new Error('Payment finalization race: payment update lost guard');
    }

    const bookingUpdate = await tx.booking.updateMany({
      where: {
        id: attempt.payment.bookingId,
        status: BookingStatus.PENDING,
      },
      data: {
        status: BookingStatus.CONFIRMED,
        confirmedAt: now,
        version: { increment: 1 },
      },
    });

    if (bookingUpdate.count !== 1) {
      throw new Error('Payment finalization race: booking update lost guard');
    }

    const slotUpdate = await tx.venueSlot.updateMany({
      where: {
        id: { in: slotIds },
        status: SlotStatus.LOCKED,
      },
      data: {
        status: SlotStatus.BOOKED,
        version: { increment: 1 },
      },
    });

    if (slotUpdate.count !== slotIds.length) {
      throw new Error('Payment finalization race: slot update lost guard');
    }

    return { type: 'finalized' };
  }

  private isAlreadyFinalized(attempt: PaymentFinalizationAttempt) {
    const booking = attempt.payment.booking;
    const allSlotsBooked =
      booking.bookingSlots.length > 0 &&
      booking.bookingSlots.every(
        (bookingSlot) => bookingSlot.venueSlot.status === SlotStatus.BOOKED,
      );

    return (
      attempt.status === PaymentAttemptStatus.PAID &&
      attempt.payment.status === PaymentStatus.PAID &&
      (booking.status === BookingStatus.CONFIRMED ||
        booking.status === BookingStatus.COMPLETED) &&
      allSlotsBooked
    );
  }

  private getPaymentFinalizationBlockReason(
    attempt: PaymentFinalizationAttempt,
    expectedProvider: PaymentProvider,
  ) {
    const booking = attempt.payment.booking;
    const resolvedExpiresAt = this.resolveAttemptExpiresAt(
      booking.expiresAt,
      booking.createdAt,
    );

    if (attempt.provider !== expectedProvider) {
      return 'PAYMENT_RECONCILIATION_PROVIDER_MISMATCH';
    }

    if (
      attempt.status !== PaymentAttemptStatus.PENDING &&
      attempt.status !== PaymentAttemptStatus.PROCESSING
    ) {
      return `PAYMENT_RECONCILIATION_ATTEMPT_${attempt.status}`;
    }

    if (attempt.payment.provider !== expectedProvider) {
      return 'PAYMENT_RECONCILIATION_PAYMENT_PROVIDER_MISMATCH';
    }

    if (attempt.payment.status !== PaymentStatus.PENDING) {
      return `PAYMENT_RECONCILIATION_PAYMENT_${attempt.payment.status}`;
    }

    if (booking.status !== BookingStatus.PENDING) {
      return `PAYMENT_RECONCILIATION_BOOKING_${booking.status}`;
    }

    if (resolvedExpiresAt.getTime() <= Date.now()) {
      return 'PAYMENT_RECONCILIATION_BOOKING_EXPIRED';
    }

    if (booking.bookingSlots.length === 0) {
      return 'PAYMENT_RECONCILIATION_NO_BOOKING_SLOTS';
    }

    const unlockedSlot = booking.bookingSlots.find(
      (bookingSlot) => bookingSlot.venueSlot.status !== SlotStatus.LOCKED,
    );

    if (unlockedSlot) {
      return `PAYMENT_RECONCILIATION_SLOT_${unlockedSlot.venueSlot.status}`;
    }

    return null;
  }

  private async markMomoWebhookRequiresReconciliation(
    tx: Prisma.TransactionClient,
    verified: VerifiedPaymentWebhookResult,
    attempt: PaymentFinalizationAttempt,
    eventId: string,
    reason: string,
  ) {
    const now = new Date();
    const message =
      'MoMo reported successful payment, but booking could not be safely confirmed automatically';

    await tx.paymentAttempt.update({
      where: { id: attempt.id },
      data: {
        status:
          attempt.status === PaymentAttemptStatus.PAID
            ? PaymentAttemptStatus.PAID
            : PaymentAttemptStatus.REQUIRES_RECONCILIATION,
        providerTransactionId:
          verified.providerTransactionId ?? attempt.providerTransactionId,
        failedAt: now,
        failureCode: reason,
        failureMessage: message,
      },
    });

    await tx.payment.update({
      where: { id: attempt.paymentId },
      data: {
        status:
          attempt.payment.status === PaymentStatus.PAID
            ? PaymentStatus.PAID
            : PaymentStatus.FAILED,
        failedAt: now,
        failureCode: reason,
        failureMessage: message,
        version: { increment: 1 },
      },
    });

    await tx.paymentWebhookEvent.update({
      where: { id: eventId },
      data: {
        attemptId: attempt.id,
        processingStatus: PaymentWebhookProcessingStatus.FAILED,
        processedAt: now,
      },
    });
  }

  private async markVnpayWebhookRequiresReconciliation(
    tx: Prisma.TransactionClient,
    verified: VerifiedPaymentWebhookResult,
    attempt: PaymentFinalizationAttempt,
    eventId: string,
    reason: string,
  ) {
    const now = new Date();
    const message =
      'VNPay reported successful payment, but booking could not be safely confirmed automatically';

    await tx.paymentAttempt.update({
      where: { id: attempt.id },
      data: {
        status:
          attempt.status === PaymentAttemptStatus.PAID
            ? PaymentAttemptStatus.PAID
            : PaymentAttemptStatus.REQUIRES_RECONCILIATION,
        providerTransactionId:
          verified.providerTransactionId ?? attempt.providerTransactionId,
        failedAt: now,
        failureCode: reason,
        failureMessage: message,
      },
    });

    await tx.payment.update({
      where: { id: attempt.paymentId },
      data: {
        status:
          attempt.payment.status === PaymentStatus.PAID
            ? PaymentStatus.PAID
            : PaymentStatus.FAILED,
        failedAt: now,
        failureCode: reason,
        failureMessage: message,
        version: { increment: 1 },
      },
    });

    await tx.paymentWebhookEvent.update({
      where: { id: eventId },
      data: {
        attemptId: attempt.id,
        processingStatus: PaymentWebhookProcessingStatus.FAILED,
        processedAt: now,
      },
    });
  }

  private webhookAmountMatches(
    verified: VerifiedPaymentWebhookResult,
    attempt: PaymentFinalizationAttempt,
  ) {
    const webhookAmount = Math.trunc(verified.amount);
    const attemptAmount = Math.trunc(Number(attempt.amount));
    const paymentAmount = Math.trunc(Number(attempt.payment.amount));
    const bookingAmount = Math.trunc(
      Number(attempt.payment.booking.totalPrice),
    );

    return (
      webhookAmount === attemptAmount &&
      webhookAmount === paymentAmount &&
      webhookAmount === bookingAmount
    );
  }

  private buildPaymentInitiationResponse(
    result: Extract<PreparedPaymentAttempt, { type: 'reused' }>,
    message: string,
  ) {
    const manualPayment = this.extractManualPaymentResponse(
      result.rawCreateResponse,
    );

    return success(
      {
        paymentId: result.paymentId,
        attemptId: result.attemptId,
        bookingId: result.bookingId,
        provider: result.provider,
        amount: result.amount,
        currency: result.currency,
        paymentUrl: result.paymentUrl,
        status: result.status,
        expiresAt: result.expiresAt,
        ...(manualPayment ?? {}),
      },
      message,
      201,
    );
  }

  private extractManualPaymentResponse(
    raw: Prisma.JsonValue | Prisma.InputJsonObject | null | undefined,
  ) {
    if (
      !raw ||
      typeof raw !== 'object' ||
      Array.isArray(raw) ||
      !('manual' in raw) ||
      raw.manual !== true
    ) {
      return null;
    }

    return {
      receiverName: this.optionalJsonString(raw.receiverName),
      phone: this.optionalJsonString(raw.phone),
      transferContent: this.optionalJsonString(raw.transferContent),
      qrImageUrl: this.optionalJsonString(raw.qrImageUrl),
      instructions: this.optionalJsonString(raw.instructions),
    };
  }

  private buildVnpayIpnResponse(RspCode: string, Message: string) {
    return { RspCode, Message };
  }

  private async getVenueOwnerIds(venueId: string) {
    const owners = await this.prisma.venueOwner.findMany({
      where: { venueId, status: 'APPROVED' },
      select: { userId: true },
    });

    return owners.map((owner) => owner.userId);
  }

  private async getOrCreatePaymentAggregate(
    tx: Prisma.TransactionClient,
    input: {
      bookingId: string;
      userId: string;
      provider: PaymentProvider;
      amount: Prisma.Decimal;
      expiresAt: Date;
    },
  ) {
    const payment = await tx.payment.upsert({
      where: { bookingId: input.bookingId },
      create: {
        bookingId: input.bookingId,
        userId: input.userId,
        amount: input.amount,
        currency: DEFAULT_CURRENCY,
        method: this.toPaymentMethod(input.provider),
        provider: input.provider,
        status: PaymentStatus.PENDING,
        expiresAt: input.expiresAt,
      },
      update: {},
    });

    if (payment.status === PaymentStatus.PAID) {
      throw new ConflictException('Booking is already paid');
    }

    if (
      payment.status === PaymentStatus.REFUNDED_FULL ||
      payment.status === PaymentStatus.REFUNDED_HALF
    ) {
      throw new ConflictException(
        `Payment is ${payment.status} and cannot be retried`,
      );
    }

    return tx.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.PENDING,
        amount: input.amount,
        method: this.toPaymentMethod(input.provider),
        provider: input.provider,
        currency: DEFAULT_CURRENCY,
        expiresAt: input.expiresAt,
        failedAt: null,
        failureCode: null,
        failureMessage: null,
        version: { increment: 1 },
      },
    });
  }

  private toPaymentMethod(provider: PaymentProvider) {
    return provider === PaymentProvider.MOMO ||
      provider === PaymentProvider.MOMO_MANUAL
      ? PaymentMethod.MOMO
      : PaymentMethod.VNPAY;
  }

  private createProviderOrderId(provider: PaymentProvider) {
    return `${provider}-${Date.now()}-${randomUUID()}`;
  }

  private createProviderRequestId(provider: PaymentProvider) {
    return `${provider}-REQ-${Date.now()}-${randomUUID()}`;
  }

  private resolveAttemptExpiresAt(
    bookingExpiresAt: Date | null,
    bookingCreatedAt: Date,
  ) {
    if (bookingExpiresAt) {
      return bookingExpiresAt;
    }

    const expirationMinutes = resolvePaymentHoldMinutes(this.configService);
    return new Date(bookingCreatedAt.getTime() + expirationMinutes * 60 * 1000);
  }

  private buildReturnUrl(provider: PaymentProvider, bookingId: string) {
    const baseUrl = this.paymentConfig.getReturnBaseUrl();

    return `${this.trimTrailingSlash(baseUrl)}/payments/return?bookingId=${encodeURIComponent(bookingId)}`;
  }

  private buildWebhookUrl(provider: PaymentProvider) {
    const baseUrl = this.paymentConfig.getWebhookBaseUrl();

    return `${this.trimTrailingSlash(baseUrl)}/payments/webhooks/${provider.toLowerCase()}`;
  }

  private trimTrailingSlash(value: string) {
    return value.replace(/\/+$/, '');
  }

  private getNumberConfig(key: string, fallback: number) {
    const raw = this.configService.get<string | number>(key);
    const value = typeof raw === 'number' ? raw : Number(raw);

    return Number.isFinite(value) ? value : fallback;
  }

  private serializeProviderError(error: unknown): Prisma.InputJsonObject {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
      };
    }

    return {
      message: String(error),
    };
  }

  private getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }

  private optionalJsonString(value: unknown) {
    return typeof value === 'string' && value.length > 0 ? value : null;
  }

  private assertMockPaymentCompletionEnabled() {
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');

    if (nodeEnv === 'production') {
      throw new ForbiddenException(
        'Mock payment completion is disabled in production',
      );
    }

    if (!this.paymentConfig.isMockCompletionEnabled()) {
      throw new ForbiddenException(
        'Mock payment completion is disabled. Set ENABLE_MOCK_PAYMENT=true in development to enable it.',
      );
    }
  }

  private isMockPaymentAttempt(attempt: {
    rawCreateResponse: Prisma.JsonValue | null;
    paymentUrl?: string | null;
  }) {
    const raw = attempt.rawCreateResponse;

    if (
      raw &&
      typeof raw === 'object' &&
      !Array.isArray(raw) &&
      'mock' in raw &&
      raw.mock === true
    ) {
      return true;
    }

    return attempt.paymentUrl?.includes('mockPayment=true') === true;
  }
}

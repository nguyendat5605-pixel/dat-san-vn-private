import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PaymentProvider } from '@prisma/client';
import { PaymentConfig } from '../payment.config.js';
import type { PaymentProviderService } from './payment-provider.interface.js';
import type {
  CreatePaymentAttemptInput,
  CreatePaymentAttemptResult,
  ParsePaymentReturnInput,
  PaymentReturnResult,
  VerifiedPaymentWebhookResult,
  VerifyPaymentWebhookInput,
} from '../types/payment-provider.types.js';

@Injectable()
export class MomoManualPaymentProvider implements PaymentProviderService {
  readonly provider = PaymentProvider.MOMO_MANUAL;

  constructor(private readonly paymentConfig: PaymentConfig) {}

  async createPaymentAttempt(
    input: CreatePaymentAttemptInput,
  ): Promise<CreatePaymentAttemptResult> {
    const config = this.paymentConfig.getMomoManualConfig();

    if (!config.enabled) {
      throw new ServiceUnavailableException(
        'Manual MoMo payment is disabled',
      );
    }

    if (!config.phone) {
      throw new ServiceUnavailableException(
        'Manual MoMo payment phone number is not configured',
      );
    }

    const transferContent = `${config.transferPrefix}-${this.shortBookingId(input.bookingId)}`;

    return {
      paymentUrl: null,
      rawProviderResponse: {
        manual: true,
        provider: this.provider,
        providerOrderId: input.providerOrderId,
        providerRequestId: input.providerRequestId,
        bookingId: input.bookingId,
        amount: input.amount,
        currency: input.currency,
        receiverName: config.receiverName,
        phone: config.phone,
        qrImageUrl: config.qrImageUrl ?? null,
        transferContent,
        instructions:
          'Quét QR MoMo và nhập đúng nội dung chuyển khoản. Chủ sân sẽ xác nhận sau khi nhận tiền.',
      },
    };
  }

  async verifyWebhook(
    _input: VerifyPaymentWebhookInput,
  ): Promise<VerifiedPaymentWebhookResult> {
    return {
      provider: this.provider,
      valid: false,
      providerOrderId: '',
      amount: 0,
      currency: 'VND',
      isSuccess: false,
      payloadHash: '',
      rawPayload: {},
    };
  }

  async parseReturnUrl(
    input: ParsePaymentReturnInput,
  ): Promise<PaymentReturnResult> {
    return {
      provider: this.provider,
      providerOrderId: undefined,
      rawPayload: { ...input.query },
    };
  }

  private shortBookingId(bookingId: string) {
    return bookingId.replace(/-/g, '').slice(0, 10).toUpperCase();
  }
}

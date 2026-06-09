import { Injectable, NotImplementedException } from '@nestjs/common';
import { PaymentProvider } from '@prisma/client';
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
export class MockPaymentProvider implements PaymentProviderService {
  readonly provider = PaymentProvider.MOMO;

  async createPaymentAttempt(
    input: CreatePaymentAttemptInput,
  ): Promise<CreatePaymentAttemptResult> {
    const paymentUrl = new URL(input.returnUrl);
    paymentUrl.searchParams.set('mockPayment', 'true');
    paymentUrl.searchParams.set('provider', input.provider);
    paymentUrl.searchParams.set('bookingId', input.bookingId);
    paymentUrl.searchParams.set('paymentId', input.paymentId);
    paymentUrl.searchParams.set('attemptId', input.attemptId);
    paymentUrl.searchParams.set('orderId', input.providerOrderId);
    paymentUrl.searchParams.set('requestId', input.providerRequestId);

    return {
      paymentUrl: paymentUrl.toString(),
      rawProviderResponse: {
        mock: true,
        provider: input.provider,
        providerOrderId: input.providerOrderId,
        providerRequestId: input.providerRequestId,
        amount: input.amount,
        currency: input.currency,
        webhookUrl: input.webhookUrl,
      },
    };
  }

  async verifyWebhook(
    _input: VerifyPaymentWebhookInput,
  ): Promise<VerifiedPaymentWebhookResult> {
    throw new NotImplementedException(
      'Mock payment webhook processing is not implemented in this phase',
    );
  }

  async parseReturnUrl(
    input: ParsePaymentReturnInput,
  ): Promise<PaymentReturnResult> {
    return {
      provider: input.provider,
      providerOrderId: this.firstQueryValue(input.query.orderId),
      rawPayload: { ...input.query },
    };
  }

  private firstQueryValue(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value;
  }
}

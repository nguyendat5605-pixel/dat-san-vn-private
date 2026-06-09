import { PaymentProvider } from '@prisma/client';
import type {
  CreatePaymentAttemptInput,
  CreatePaymentAttemptResult,
  ParsePaymentReturnInput,
  PaymentReturnResult,
  VerifiedPaymentWebhookResult,
  VerifyPaymentWebhookInput,
} from '../types/payment-provider.types.js';

export interface PaymentProviderService {
  readonly provider: PaymentProvider;

  createPaymentAttempt(
    input: CreatePaymentAttemptInput,
  ): Promise<CreatePaymentAttemptResult>;

  verifyWebhook(
    input: VerifyPaymentWebhookInput,
  ): Promise<VerifiedPaymentWebhookResult>;

  parseReturnUrl(input: ParsePaymentReturnInput): Promise<PaymentReturnResult>;
}

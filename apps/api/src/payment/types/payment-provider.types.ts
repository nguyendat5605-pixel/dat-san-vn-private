import { PaymentProvider, Prisma } from '@prisma/client';

export interface CreatePaymentAttemptInput {
  provider: PaymentProvider;
  bookingId: string;
  paymentId: string;
  attemptId: string;
  amount: number;
  currency: string;
  providerOrderId: string;
  providerRequestId: string;
  returnUrl: string;
  webhookUrl: string;
  clientIp?: string;
}

export interface CreatePaymentAttemptResult {
  paymentUrl?: string | null;
  rawProviderResponse: Prisma.InputJsonObject;
}

export interface VerifyPaymentWebhookInput {
  provider: PaymentProvider;
  rawBody: Buffer | string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
}

export interface VerifiedPaymentWebhookResult {
  provider: PaymentProvider;
  valid: boolean;
  partnerCode?: string;
  providerOrderId: string;
  providerRequestId?: string;
  providerTransactionId?: string;
  providerEventId?: string;
  amount: number;
  currency: string;
  isSuccess: boolean;
  resultCode?: number;
  message?: string;
  responseTime?: string;
  payloadHash: string;
  rawPayload: Prisma.InputJsonObject;
}

export interface ParsePaymentReturnInput {
  provider: PaymentProvider;
  query: Record<string, string | string[] | undefined>;
}

export interface PaymentReturnResult {
  provider: PaymentProvider;
  providerOrderId?: string;
  rawPayload: Prisma.InputJsonObject;
}

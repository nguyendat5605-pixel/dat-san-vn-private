import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PaymentProvider, Prisma } from '@prisma/client';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
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
export class VnpayPaymentProvider implements PaymentProviderService {
  readonly provider = PaymentProvider.VNPAY;
  private readonly logger = new Logger(VnpayPaymentProvider.name);

  constructor(private readonly paymentConfig: PaymentConfig) {}

  async createPaymentAttempt(
    input: CreatePaymentAttemptInput,
  ): Promise<CreatePaymentAttemptResult> {
    const config = this.getValidatedSandboxConfig();
    const returnUrl = this.withBookingId(
      config.returnUrl ?? input.returnUrl,
      input.bookingId,
    );
    const ipnUrl = config.ipnUrl ?? input.webhookUrl;
    const vnpParams: Record<string, string> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: config.tmnCode,
      vnp_Amount: String(this.toVnpayAmount(input.amount)),
      vnp_CurrCode: input.currency || 'VND',
      vnp_TxnRef: input.providerOrderId,
      vnp_OrderInfo: `DatSanVN booking ${input.bookingId} attempt ${input.attemptId}`,
      vnp_OrderType: 'other',
      vnp_Locale: 'vn',
      vnp_ReturnUrl: returnUrl,
      vnp_IpAddr: input.clientIp ?? '127.0.0.1',
      vnp_CreateDate: this.formatVnpayDate(new Date()),
    };

    const signedData = this.buildSignedData(vnpParams);
    const secureHash = this.sign(signedData, config.hashSecret);
    const paymentUrl = new URL(config.payUrl);
    paymentUrl.search = `${signedData}&vnp_SecureHash=${secureHash}`;

    return {
      paymentUrl: paymentUrl.toString(),
      rawProviderResponse: {
        sandbox: true,
        provider: this.provider,
        providerOrderId: input.providerOrderId,
        providerRequestId: input.providerRequestId,
        amount: input.amount,
        currency: input.currency,
        payUrl: config.payUrl,
        returnUrl,
        ipnUrl,
      },
    };
  }

  async verifyWebhook(
    input: VerifyPaymentWebhookInput,
  ): Promise<VerifiedPaymentWebhookResult> {
    const config = this.getValidatedWebhookConfig();
    const payload = this.parseWebhookPayload(input);
    const vnpParams = this.extractVnpParams(payload);
    const signature = this.optionalString(payload.vnp_SecureHash);
    const signedData = this.buildSignedData(vnpParams);
    const expectedSignature = this.sign(signedData, config.hashSecret);
    const valid = this.isSignatureEqual(signature, expectedSignature);
    const providerOrderId = this.requiredString(payload.vnp_TxnRef);
    const providerTransactionId =
      this.optionalString(payload.vnp_TransactionNo) ??
      this.optionalString(payload.vnp_BankTranNo);
    const responseCode = this.optionalString(payload.vnp_ResponseCode);
    const transactionStatus = this.optionalString(
      payload.vnp_TransactionStatus,
    );
    const amount = this.optionalNumber(payload.vnp_Amount);

    return {
      provider: this.provider,
      valid,
      partnerCode: this.optionalString(payload.vnp_TmnCode),
      providerOrderId,
      providerTransactionId,
      providerEventId: this.buildProviderEventId({
        providerOrderId,
        providerTransactionId,
        responseCode,
        transactionStatus,
        payDate: this.optionalString(payload.vnp_PayDate),
      }),
      amount: amount ? amount / 100 : 0,
      currency: 'VND',
      isSuccess: responseCode === '00' && transactionStatus === '00',
      resultCode: this.optionalNumber(responseCode),
      message:
        this.optionalString(payload.vnp_Message) ??
        this.optionalString(payload.vnp_OrderInfo),
      responseTime: this.optionalString(payload.vnp_PayDate),
      payloadHash: this.buildPayloadHash({
        signature,
        providerOrderId,
        providerTransactionId,
        responseCode,
        transactionStatus,
      }),
      rawPayload: this.sanitizePayload(payload),
    };
  }

  async parseReturnUrl(
    input: ParsePaymentReturnInput,
  ): Promise<PaymentReturnResult> {
    return {
      provider: this.provider,
      providerOrderId: this.firstQueryValue(input.query.vnp_TxnRef),
      rawPayload: { ...input.query },
    };
  }

  private getValidatedSandboxConfig() {
    const config = this.paymentConfig.getVnpaySandboxConfig();
    if (!config.enabled) {
      throw new ServiceUnavailableException('VNPay sandbox provider is disabled');
    }

    const missing = [
      ['VNPAY_TMN_CODE', config.tmnCode],
      ['VNPAY_HASH_SECRET', config.hashSecret],
      ['VNPAY_PAY_URL', config.payUrl],
    ]
      .filter(([, value]) => !value)
      .map(([key]) => key);

    if (missing.length > 0) {
      this.logger.warn(
        `VNPay sandbox provider missing required config: ${missing.join(', ')}`,
      );
      throw new ServiceUnavailableException(
        `VNPay sandbox provider missing required config: ${missing.join(', ')}`,
      );
    }

    return config as {
      tmnCode: string;
      hashSecret: string;
      payUrl: string;
      returnUrl?: string;
      ipnUrl?: string;
    };
  }

  private getValidatedWebhookConfig() {
    const config = this.paymentConfig.getVnpaySandboxConfig();
    const missing = [
      ['VNPAY_TMN_CODE', config.tmnCode],
      ['VNPAY_HASH_SECRET', config.hashSecret],
    ]
      .filter(([, value]) => !value)
      .map(([key]) => key);

    if (missing.length > 0) {
      this.logger.warn(
        `VNPay verification missing required config: ${missing.join(', ')}`,
      );
      throw new ServiceUnavailableException(
        `VNPay verification missing required config: ${missing.join(', ')}`,
      );
    }

    return config as {
      tmnCode: string;
      hashSecret: string;
    };
  }

  private toVnpayAmount(amount: number) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadGatewayException('Invalid VNPay payment amount');
    }

    return Math.trunc(amount * 100);
  }

  private withBookingId(returnUrl: string, bookingId: string) {
    const url = new URL(returnUrl);
    if (!url.searchParams.has('bookingId')) {
      url.searchParams.set('bookingId', bookingId);
    }

    return url.toString();
  }

  private buildSignedData(params: Record<string, string>) {
    return Object.entries(params)
      .filter(
        ([key, value]) =>
          key.startsWith('vnp_') &&
          key !== 'vnp_SecureHash' &&
          key !== 'vnp_SecureHashType' &&
          value !== undefined &&
          value !== null &&
          String(value).length > 0,
      )
      .sort(([left], [right]) => left.localeCompare(right))
      .map(
        ([key, value]) =>
          `${this.vnpayEncode(key)}=${this.vnpayEncode(String(value))}`,
      )
      .join('&');
  }

  private sign(signedData: string, hashSecret: string) {
    return createHmac('sha512', hashSecret).update(signedData).digest('hex');
  }

  private isSignatureEqual(signature: string | undefined, expected: string) {
    if (!signature) {
      return false;
    }

    const received = Buffer.from(signature, 'utf8');
    const computed = Buffer.from(expected, 'utf8');

    return (
      received.length === computed.length && timingSafeEqual(received, computed)
    );
  }

  private parseWebhookPayload(input: VerifyPaymentWebhookInput) {
    const queryPayload = this.normalizeRecord(input.query);
    if (Object.keys(queryPayload).some((key) => key.startsWith('vnp_'))) {
      return queryPayload;
    }

    const bodyPayload = this.normalizeRecord(input.body);
    if (Object.keys(bodyPayload).length > 0) {
      return bodyPayload;
    }

    const rawBody =
      typeof input.rawBody === 'string'
        ? input.rawBody
        : input.rawBody.toString('utf8');
    const params = new URLSearchParams(rawBody);
    const parsed: Record<string, string> = {};
    params.forEach((value, key) => {
      parsed[key] = value;
    });

    return parsed;
  }

  private normalizeRecord(input: unknown) {
    const normalized: Record<string, string> = {};
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return normalized;
    }

    for (const [key, value] of Object.entries(input)) {
      const normalizedValue = Array.isArray(value) ? value[0] : value;
      if (
        typeof normalizedValue === 'string' ||
        typeof normalizedValue === 'number' ||
        typeof normalizedValue === 'boolean'
      ) {
        normalized[key] = String(normalizedValue);
      }
    }

    return normalized;
  }

  private extractVnpParams(payload: Record<string, string>) {
    const params: Record<string, string> = {};
    for (const [key, value] of Object.entries(payload)) {
      if (key.startsWith('vnp_')) {
        params[key] = value;
      }
    }

    return params;
  }

  private formatVnpayDate(date: Date) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .reduce<Record<string, string>>((acc, part) => {
        if (part.type !== 'literal') {
          acc[part.type] = part.value;
        }
        return acc;
      }, {});

    return `${parts.year}${parts.month}${parts.day}${parts.hour}${parts.minute}${parts.second}`;
  }

  private vnpayEncode(value: string) {
    return encodeURIComponent(value).replace(/%20/g, '+');
  }

  private buildProviderEventId(input: {
    providerOrderId: string;
    providerTransactionId?: string;
    responseCode?: string;
    transactionStatus?: string;
    payDate?: string;
  }) {
    return [
      input.providerOrderId,
      input.providerTransactionId ?? '',
      input.responseCode ?? '',
      input.transactionStatus ?? '',
      input.payDate ?? '',
    ].join(':');
  }

  private buildPayloadHash(input: {
    signature?: string;
    providerOrderId: string;
    providerTransactionId?: string;
    responseCode?: string;
    transactionStatus?: string;
  }) {
    const stableKey = [
      this.provider,
      input.providerOrderId,
      input.providerTransactionId ?? '',
      input.responseCode ?? '',
      input.transactionStatus ?? '',
      input.signature ?? '',
    ].join(':');

    return createHash('sha256').update(stableKey).digest('hex');
  }

  private sanitizePayload(
    payload: Record<string, string>,
  ): Prisma.InputJsonObject {
    const sanitized: Record<string, Prisma.InputJsonValue> = {};

    for (const [key, value] of Object.entries(payload)) {
      if (key === 'vnp_SecureHash') {
        continue;
      }

      sanitized[key] = value;
    }

    return sanitized as Prisma.InputJsonObject;
  }

  private firstQueryValue(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value;
  }

  private requiredString(value: unknown) {
    return this.optionalString(value) ?? '';
  }

  private optionalString(value: unknown) {
    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'number' || typeof value === 'bigint') {
      return String(value);
    }

    return undefined;
  }

  private optionalNumber(value: unknown) {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : undefined;
    }

    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    }

    return undefined;
  }
}

import {
  BadGatewayException,
  Injectable,
  Logger,
  NotImplementedException,
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
export class MomoPaymentProvider implements PaymentProviderService {
  readonly provider = PaymentProvider.MOMO;
  private readonly logger = new Logger(MomoPaymentProvider.name);

  constructor(private readonly paymentConfig: PaymentConfig) {}

  async createPaymentAttempt(
    input: CreatePaymentAttemptInput,
  ): Promise<CreatePaymentAttemptResult> {
    const config = this.getValidatedSandboxConfig();
    const requestType = 'payWithMethod';
    const extraData = '';
    const amount = this.toMomoAmount(input.amount);
    const orderInfo = `DatSanVN booking ${input.bookingId}`;
    const signature = this.signCreatePayment({
      accessKey: config.accessKey,
      amount,
      extraData,
      ipnUrl: input.webhookUrl,
      orderId: input.providerOrderId,
      orderInfo,
      partnerCode: config.partnerCode,
      redirectUrl: input.returnUrl,
      requestId: input.providerRequestId,
      requestType,
      secretKey: config.secretKey,
    });
    const requestBody = {
      partnerCode: config.partnerCode,
      requestId: input.providerRequestId,
      amount,
      orderId: input.providerOrderId,
      orderInfo,
      redirectUrl: input.returnUrl,
      ipnUrl: input.webhookUrl,
      requestType,
      extraData,
      lang: 'vi',
      signature,
    };

    this.logger.log(
      `Creating MoMo sandbox payment attempt attemptId=${input.attemptId} orderId=${input.providerOrderId}`,
    );

    const response = await this.postCreatePayment(
      config.endpoint,
      requestBody,
      config.timeoutMs,
    );
    const paymentUrl = this.extractPaymentUrl(response);

    if (response.resultCode !== 0 || !paymentUrl) {
      throw new BadGatewayException(
        `MoMo sandbox create payment failed: resultCode=${response.resultCode ?? 'unknown'}`,
      );
    }

    return {
      paymentUrl,
      rawProviderResponse: this.sanitizeMomoResponse(response),
    };
  }

  async verifyWebhook(
    input: VerifyPaymentWebhookInput,
  ): Promise<VerifiedPaymentWebhookResult> {
    const config = this.getValidatedWebhookConfig();
    const payload = this.parseWebhookPayload(input);
    const signature = this.optionalString(payload.signature);
    const providerOrderId = this.requiredString(payload.orderId);
    const providerRequestId = this.optionalString(payload.requestId);
    const providerTransactionId = this.optionalString(payload.transId);
    const resultCode = this.optionalNumber(payload.resultCode);
    const amount = this.optionalNumber(payload.amount);
    const rawSignature = this.buildWebhookRawSignature(payload, config.accessKey);
    const expectedSignature = createHmac('sha256', config.secretKey)
      .update(rawSignature)
      .digest('hex');
    const valid = this.isSignatureEqual(signature, expectedSignature);

    return {
      provider: this.provider,
      valid,
      partnerCode: this.optionalString(payload.partnerCode),
      providerOrderId,
      providerRequestId,
      providerTransactionId,
      providerEventId: this.buildProviderEventId({
        providerOrderId,
        providerRequestId,
        providerTransactionId,
        resultCode,
      }),
      amount: amount ?? 0,
      currency: 'VND',
      isSuccess: resultCode === 0,
      resultCode,
      message: this.optionalString(payload.message),
      responseTime: this.optionalString(payload.responseTime),
      payloadHash: this.buildPayloadHash({
        rawBody: input.rawBody,
        signature,
        providerOrderId,
        providerRequestId,
        providerTransactionId,
        resultCode,
      }),
      rawPayload: this.sanitizeMomoResponse(payload),
    };
  }

  async parseReturnUrl(
    input: ParsePaymentReturnInput,
  ): Promise<PaymentReturnResult> {
    return {
      provider: this.provider,
      providerOrderId: this.firstQueryValue(input.query.orderId),
      rawPayload: { ...input.query },
    };
  }

  private firstQueryValue(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value;
  }

  private getValidatedSandboxConfig() {
    const config = this.paymentConfig.getMomoSandboxConfig();
    if (!config.enabled) {
      throw new ServiceUnavailableException('MoMo sandbox provider is disabled');
    }

    const missing = [
      ['MOMO_SANDBOX_ENDPOINT', config.endpoint],
      ['MOMO_PARTNER_CODE', config.partnerCode],
      ['MOMO_ACCESS_KEY', config.accessKey],
      ['MOMO_SECRET_KEY', config.secretKey],
    ]
      .filter(([, value]) => !value)
      .map(([key]) => key);

    if (missing.length > 0) {
      this.logger.warn(
        `MoMo sandbox provider missing required config: ${missing.join(', ')}`,
      );
      throw new ServiceUnavailableException(
        `MoMo sandbox provider missing required config: ${missing.join(', ')}`,
      );
    }

    return {
      endpoint: config.endpoint,
      partnerCode: config.partnerCode,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
      timeoutMs: config.timeoutMs,
    } as {
      endpoint: string;
      partnerCode: string;
      accessKey: string;
      secretKey: string;
      timeoutMs: number;
    };
  }

  private getValidatedWebhookConfig() {
    const config = this.paymentConfig.getMomoSandboxConfig();
    if (!config.enabled) {
      throw new ServiceUnavailableException('MoMo sandbox provider is disabled');
    }

    const missing = [
      ['MOMO_PARTNER_CODE', config.partnerCode],
      ['MOMO_ACCESS_KEY', config.accessKey],
      ['MOMO_SECRET_KEY', config.secretKey],
    ]
      .filter(([, value]) => !value)
      .map(([key]) => key);

    if (missing.length > 0) {
      this.logger.warn(
        `MoMo IPN verification missing required config: ${missing.join(', ')}`,
      );
      throw new ServiceUnavailableException(
        `MoMo IPN verification missing required config: ${missing.join(', ')}`,
      );
    }

    return {
      partnerCode: config.partnerCode,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
    } as {
      partnerCode: string;
      accessKey: string;
      secretKey: string;
    };
  }

  private toMomoAmount(amount: number) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadGatewayException('Invalid MoMo payment amount');
    }

    return Math.trunc(amount);
  }

  private signCreatePayment(input: {
    accessKey: string;
    amount: number;
    extraData: string;
    ipnUrl: string;
    orderId: string;
    orderInfo: string;
    partnerCode: string;
    redirectUrl: string;
    requestId: string;
    requestType: string;
    secretKey: string;
  }) {
    const rawSignature =
      `accessKey=${input.accessKey}` +
      `&amount=${input.amount}` +
      `&extraData=${input.extraData}` +
      `&ipnUrl=${input.ipnUrl}` +
      `&orderId=${input.orderId}` +
      `&orderInfo=${input.orderInfo}` +
      `&partnerCode=${input.partnerCode}` +
      `&redirectUrl=${input.redirectUrl}` +
      `&requestId=${input.requestId}` +
      `&requestType=${input.requestType}`;

    return createHmac('sha256', input.secretKey)
      .update(rawSignature)
      .digest('hex');
  }

  private buildWebhookRawSignature(
    payload: Record<string, unknown>,
    accessKey: string,
  ) {
    return (
      `accessKey=${accessKey}` +
      `&amount=${this.signatureValue(payload.amount)}` +
      `&extraData=${this.signatureValue(payload.extraData)}` +
      `&message=${this.signatureValue(payload.message)}` +
      `&orderId=${this.signatureValue(payload.orderId)}` +
      `&orderInfo=${this.signatureValue(payload.orderInfo)}` +
      `&orderType=${this.signatureValue(payload.orderType)}` +
      `&partnerCode=${this.signatureValue(payload.partnerCode)}` +
      `&payType=${this.signatureValue(payload.payType)}` +
      `&requestId=${this.signatureValue(payload.requestId)}` +
      `&responseTime=${this.signatureValue(payload.responseTime)}` +
      `&resultCode=${this.signatureValue(payload.resultCode)}` +
      `&transId=${this.signatureValue(payload.transId)}`
    );
  }

  private parseWebhookPayload(input: VerifyPaymentWebhookInput) {
    if (
      input.body &&
      typeof input.body === 'object' &&
      !Array.isArray(input.body) &&
      !Buffer.isBuffer(input.body)
    ) {
      return input.body as Record<string, unknown>;
    }

    const rawBody =
      typeof input.rawBody === 'string'
        ? input.rawBody
        : input.rawBody.toString('utf8');

    try {
      const parsed = JSON.parse(rawBody) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Treat malformed JSON as an unsigned payload so the service can persist
      // an INVALID_SIGNATURE event when possible.
    }

    return {};
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

  private buildProviderEventId(input: {
    providerOrderId: string;
    providerRequestId?: string;
    providerTransactionId?: string;
    resultCode?: number;
  }) {
    return [
      input.providerOrderId,
      input.providerRequestId ?? '',
      input.providerTransactionId ?? '',
      input.resultCode ?? '',
    ].join(':');
  }

  private buildPayloadHash(input: {
    rawBody: Buffer | string;
    signature?: string;
    providerOrderId: string;
    providerRequestId?: string;
    providerTransactionId?: string;
    resultCode?: number;
  }) {
    const stableKey =
      input.providerOrderId || input.providerRequestId
        ? [
            this.provider,
            input.providerOrderId,
            input.providerRequestId ?? '',
            input.providerTransactionId ?? '',
            input.resultCode ?? '',
            input.signature ?? '',
          ].join(':')
        : typeof input.rawBody === 'string'
          ? input.rawBody
          : input.rawBody.toString('utf8');

    return createHash('sha256').update(stableKey).digest('hex');
  }

  private signatureValue(value: unknown) {
    if (value === undefined || value === null) {
      return '';
    }

    return String(value);
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

  private async postCreatePayment(
    endpoint: string,
    body: Record<string, unknown>,
    timeoutMs: number,
  ): Promise<Record<string, unknown>> {
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: abortController.signal,
      });

      const payload = (await response.json().catch(() => null)) as
        | Record<string, unknown>
        | null;

      if (!response.ok) {
        throw new BadGatewayException(
          `MoMo sandbox HTTP error: status=${response.status}`,
        );
      }

      if (!payload || typeof payload !== 'object') {
        throw new BadGatewayException('MoMo sandbox returned invalid JSON');
      }

      return payload;
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);
      throw new BadGatewayException(`MoMo sandbox request failed: ${message}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  private extractPaymentUrl(response: Record<string, unknown>) {
    for (const key of ['payUrl', 'deeplink', 'qrCodeUrl', 'shortLink']) {
      const value = response[key];
      if (typeof value === 'string' && value.length > 0) {
        return value;
      }
    }

    return null;
  }

  private sanitizeMomoResponse(
    response: Record<string, unknown>,
  ): Prisma.InputJsonObject {
    const sanitized: Record<string, Prisma.InputJsonValue | null> = {};

    for (const [key, value] of Object.entries(response)) {
      if (key === 'signature') {
        continue;
      }

      if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        value === null
      ) {
        sanitized[key] = value;
      }
    }

    return sanitized as Prisma.InputJsonObject;
  }
}

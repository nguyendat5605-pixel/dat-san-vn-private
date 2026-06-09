import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentProvider } from '@prisma/client';

interface SandboxProviderConfig {
  enabled: boolean;
  endpoint?: string;
  merchantId?: string;
}

interface MomoSandboxConfig extends SandboxProviderConfig {
  partnerCode?: string;
  accessKey?: string;
  secretKey?: string;
  timeoutMs: number;
}

interface VnpaySandboxConfig extends SandboxProviderConfig {
  tmnCode?: string;
  hashSecret?: string;
  payUrl: string;
  returnUrl?: string;
  ipnUrl?: string;
}

interface MomoManualConfig {
  enabled: boolean;
  receiverName: string;
  phone: string;
  qrImageUrl?: string;
  transferPrefix: string;
}

@Injectable()
export class PaymentConfig {
  constructor(private readonly configService: ConfigService) {}

  isMockProviderEnabled() {
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    if (nodeEnv === 'production') {
      return false;
    }

    const rawEnabled = this.configService.get<string>(
      'PAYMENT_MOCK_PROVIDER_ENABLED',
    );

    return rawEnabled === undefined ? true : rawEnabled === 'true';
  }

  isMockCompletionEnabled() {
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    if (nodeEnv === 'production') {
      return false;
    }

    const rawEnabled = this.configService.get<string>('ENABLE_MOCK_PAYMENT');
    return rawEnabled === 'true';
  }

  getSandboxConfig(provider: PaymentProvider): SandboxProviderConfig {
    if (provider === PaymentProvider.MOMO_MANUAL) {
      const config = this.getMomoManualConfig();
      return {
        enabled: config.enabled,
        endpoint: config.qrImageUrl ?? 'manual',
        merchantId: config.phone,
      };
    }

    if (provider === PaymentProvider.MOMO) {
      return {
        enabled:
          this.configService.get<string>('MOMO_SANDBOX_ENABLED') === 'true',
        endpoint: this.getOptionalString('MOMO_SANDBOX_ENDPOINT'),
        merchantId: this.getOptionalString('MOMO_PARTNER_CODE'),
      };
    }

    const vnpayConfig = this.getVnpaySandboxConfig();
    return {
      enabled: vnpayConfig.enabled,
      endpoint: vnpayConfig.payUrl,
      merchantId: vnpayConfig.tmnCode,
    };
  }

  getMomoSandboxConfig(): MomoSandboxConfig {
    const enabled =
      this.configService.get<string>('MOMO_SANDBOX_ENABLED') === 'true';

    return {
      enabled,
      endpoint: this.getOptionalString('MOMO_SANDBOX_ENDPOINT'),
      merchantId: this.getOptionalString('MOMO_PARTNER_CODE'),
      partnerCode: this.getOptionalString('MOMO_PARTNER_CODE'),
      accessKey: this.getOptionalString('MOMO_ACCESS_KEY'),
      secretKey: this.getOptionalString('MOMO_SECRET_KEY'),
      timeoutMs: this.getNumberConfig('MOMO_SANDBOX_TIMEOUT_MS', 10000),
    };
  }

  getVnpaySandboxConfig(): VnpaySandboxConfig {
    const tmnCode = this.getOptionalString('VNPAY_TMN_CODE');
    const hashSecret = this.getOptionalString('VNPAY_HASH_SECRET');
    const enabled =
      this.configService.get<string>('VNPAY_SANDBOX_ENABLED') === 'true' ||
      Boolean(tmnCode && hashSecret);

    return {
      enabled,
      endpoint:
        this.getOptionalString('VNPAY_PAY_URL') ??
        this.getOptionalString('VNPAY_SANDBOX_ENDPOINT') ??
        'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
      merchantId: tmnCode,
      tmnCode,
      hashSecret,
      payUrl:
        this.getOptionalString('VNPAY_PAY_URL') ??
        this.getOptionalString('VNPAY_SANDBOX_ENDPOINT') ??
        'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
      returnUrl: this.getOptionalString('VNPAY_RETURN_URL'),
      ipnUrl: this.getOptionalString('VNPAY_IPN_URL'),
    };
  }

  getMomoManualConfig(): MomoManualConfig {
    return {
      enabled:
        this.configService.get<string>('MOMO_MANUAL_ENABLED', 'true') ===
        'true',
      receiverName:
        this.getOptionalString('MOMO_MANUAL_RECEIVER_NAME') ?? 'DAT SAN VN',
      phone: this.getOptionalString('MOMO_MANUAL_PHONE') ?? '',
      qrImageUrl: this.getOptionalString('MOMO_MANUAL_QR_IMAGE_URL'),
      transferPrefix:
        this.getOptionalString('MOMO_MANUAL_TRANSFER_PREFIX') ?? 'DSVN',
    };
  }

  getReturnBaseUrl() {
    return (
      this.getOptionalString('PAYMENT_RETURN_BASE_URL') ??
      this.getOptionalString('FRONTEND_URL') ??
      'http://localhost:3001'
    );
  }

  getWebhookBaseUrl() {
    return (
      this.getOptionalString('PAYMENT_WEBHOOK_BASE_URL') ??
      `http://localhost:${this.configService.get<string>('PORT') ?? '3000'}/api`
    );
  }

  private getOptionalString(key: string) {
    const value = this.configService.get<string>(key);
    return value && value.trim().length > 0 ? value.trim() : undefined;
  }

  private getNumberConfig(key: string, fallback: number) {
    const raw = this.configService.get<string | number>(key);
    const value = typeof raw === 'number' ? raw : Number(raw);

    return Number.isFinite(value) && value > 0 ? value : fallback;
  }
}

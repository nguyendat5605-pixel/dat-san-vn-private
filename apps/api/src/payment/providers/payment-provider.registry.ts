import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PaymentProvider } from '@prisma/client';
import { PaymentConfig } from '../payment.config.js';
import { MomoManualPaymentProvider } from './momo-manual-payment.provider.js';
import { MomoPaymentProvider } from './momo-payment.provider.js';
import { MockPaymentProvider } from './mock-payment.provider.js';
import type { PaymentProviderService } from './payment-provider.interface.js';
import { VnpayPaymentProvider } from './vnpay-payment.provider.js';

@Injectable()
export class PaymentProviderRegistry {
  private readonly logger = new Logger(PaymentProviderRegistry.name);

  constructor(
    private readonly paymentConfig: PaymentConfig,
    private readonly mockPaymentProvider: MockPaymentProvider,
    private readonly momoManualPaymentProvider: MomoManualPaymentProvider,
    private readonly momoPaymentProvider: MomoPaymentProvider,
    private readonly vnpayPaymentProvider: VnpayPaymentProvider,
  ) {}

  getProvider(provider: PaymentProvider): PaymentProviderService {
    if (provider === PaymentProvider.MOMO_MANUAL) {
      const config = this.paymentConfig.getMomoManualConfig();
      if (!config.enabled) {
        throw new ServiceUnavailableException(
          'Manual MoMo payment is disabled. Set MOMO_MANUAL_ENABLED=true to enable it.',
        );
      }

      if (!config.phone) {
        throw new ServiceUnavailableException(
          'Manual MoMo payment is enabled but MOMO_MANUAL_PHONE is missing.',
        );
      }

      this.logger.log('Manual MoMo payment provider enabled');
      return this.momoManualPaymentProvider;
    }

    const sandboxConfig = this.paymentConfig.getSandboxConfig(provider);
    if (sandboxConfig.enabled) {
      this.assertSandboxConfig(provider, sandboxConfig);
      this.logger.log(`${provider} sandbox payment provider enabled`);
      return provider === PaymentProvider.MOMO
        ? this.momoPaymentProvider
        : this.vnpayPaymentProvider;
    }

    if (provider === PaymentProvider.VNPAY) {
      this.logger.warn(
        'VNPAY sandbox disabled; local mock fallback is not allowed for VNPay',
      );
      throw new ServiceUnavailableException(
        'VNPAY sandbox is disabled. Set VNPAY_TMN_CODE and VNPAY_HASH_SECRET for VNPay sandbox payments.',
      );
    }

    if (this.paymentConfig.isMockProviderEnabled()) {
      this.logger.log(
        `${provider} sandbox disabled; using local mock payment provider`,
      );
      return this.mockPaymentProvider;
    }

    this.logger.warn(`${provider} payment provider disabled`);
    throw new ServiceUnavailableException(
      `Payment provider ${provider} is disabled. Enable its sandbox config or local mock provider explicitly.`,
    );
  }

  private assertSandboxConfig(
    provider: PaymentProvider,
    config: { endpoint?: string; merchantId?: string },
  ) {
    if (!config.endpoint || !config.merchantId) {
      throw new ServiceUnavailableException(
        `${provider} sandbox is enabled but required sandbox config is missing`,
      );
    }
  }
}

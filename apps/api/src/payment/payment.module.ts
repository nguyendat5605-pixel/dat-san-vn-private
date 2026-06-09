import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PaymentConfig } from './payment.config.js';
import { PaymentController } from './payment.controller.js';
import { PaymentInitiationIdempotencyService } from './payment-initiation-idempotency.service.js';
import { PaymentService } from './payment.service.js';
import { MomoManualPaymentProvider } from './providers/momo-manual-payment.provider.js';
import { MomoPaymentProvider } from './providers/momo-payment.provider.js';
import { MockPaymentProvider } from './providers/mock-payment.provider.js';
import { PaymentProviderRegistry } from './providers/payment-provider.registry.js';
import { VnpayPaymentProvider } from './providers/vnpay-payment.provider.js';

@Module({
  imports: [AuthModule],
  controllers: [PaymentController],
  providers: [
    PaymentConfig,
    PaymentService,
    PaymentInitiationIdempotencyService,
    PaymentProviderRegistry,
    MockPaymentProvider,
    MomoManualPaymentProvider,
    MomoPaymentProvider,
    VnpayPaymentProvider,
  ],
  exports: [PaymentService],
})
export class PaymentModule {}

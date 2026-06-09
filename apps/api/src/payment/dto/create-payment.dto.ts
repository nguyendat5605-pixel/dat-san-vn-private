import { PaymentProvider } from '@prisma/client';
import { IsEnum, IsUUID } from 'class-validator';

export class CreatePaymentDto {
  @IsUUID()
  bookingId: string;

  @IsEnum(PaymentProvider)
  provider: PaymentProvider;
}

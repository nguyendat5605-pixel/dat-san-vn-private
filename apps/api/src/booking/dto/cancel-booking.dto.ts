import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CancelBookingDto {
  @IsUUID()
  bookingId: string;

  @IsString()
  @IsOptional()
  reason?: string;
}

import { IsUUID, IsNotEmpty, IsOptional, IsString, IsBoolean } from 'class-validator';

export class CreateBookingDto {
  @IsUUID()
  @IsNotEmpty()
  fieldId: string;

  @IsUUID()
  @IsNotEmpty()
  timeSlotId: string;

  @IsString()
  @IsOptional()
  note?: string;

  @IsBoolean()
  @IsOptional()
  isWalkIn?: boolean;
}

import { IsArray, IsEnum, IsOptional, IsBoolean } from 'class-validator';
import { StaffPermission } from '@prisma/client';

export class UpdateStaffDto {
  @IsOptional()
  @IsArray()
  @IsEnum(StaffPermission, { each: true })
  permissions?: StaffPermission[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

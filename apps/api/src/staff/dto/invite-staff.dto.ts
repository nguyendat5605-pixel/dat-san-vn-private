import { IsEmail, IsArray, IsEnum } from 'class-validator';
import { StaffPermission } from '@prisma/client';

export class InviteStaffDto {
  @IsEmail()
  email: string;

  @IsArray()
  @IsEnum(StaffPermission, { each: true })
  permissions: StaffPermission[];
}

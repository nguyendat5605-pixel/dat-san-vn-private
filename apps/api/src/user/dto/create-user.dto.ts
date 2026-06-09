import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { UserRole } from '@prisma/client';

/**
 * CreateUserDto — used internally when syncing users from Clerk.
 *
 * NOT exposed via REST API — users are created through Clerk webhooks only.
 * This DTO is used by UserService.syncFromClerk() for validation.
 */
export class CreateUserDto {
  @IsString()
  clerkId!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MaxLength(200)
  fullName!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

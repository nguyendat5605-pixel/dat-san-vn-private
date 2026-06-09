// ============================================================
// DatSanVN — Create Field DTO
// Validation rules for adding a field (sân con) to a venue
// ============================================================

import { IsString, IsEnum, IsOptional, MinLength, MaxLength } from 'class-validator';

// Using string enum values matching Prisma's SportType
const SPORT_TYPES = [
  'FOOTBALL',
  'BADMINTON',
  'TENNIS',
  'BASKETBALL',
  'VOLLEYBALL',
  'TABLE_TENNIS',
  'PICKLEBALL',
] as const;

// Using string enum values matching Prisma's FieldSize
const FIELD_SIZES = [
  'FIELD_5',
  'FIELD_7',
  'FIELD_11',
  'OTHER',
] as const;

export class CreateFieldDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsEnum(SPORT_TYPES, {
    message: `sportType must be one of: ${SPORT_TYPES.join(', ')}`,
  })
  sportType: (typeof SPORT_TYPES)[number];

  @IsOptional()
  @IsEnum(FIELD_SIZES, {
    message: `size must be one of: ${FIELD_SIZES.join(', ')}`,
  })
  size?: (typeof FIELD_SIZES)[number];
}

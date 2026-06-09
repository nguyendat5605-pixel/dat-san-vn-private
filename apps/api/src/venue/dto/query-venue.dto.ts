// ============================================================
// DatSanVN — Query Venue DTO
// Filter + pagination for listing venues
// ============================================================

import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { SportType } from '@dat-san-vn/types';

const FIELD_SIZES = ['FIELD_5', 'FIELD_7', 'FIELD_11', 'OTHER'] as const;

export class QueryVenueDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  district?: string;

  /**
   * Filter by sportType — trả về venues có ít nhất 1 field thuộc sportType này.
   */
  @IsOptional()
  @IsString()
  sportType?: SportType;

  @IsOptional()
  @IsIn(FIELD_SIZES)
  size?: (typeof FIELD_SIZES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceMax?: number;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  startTime?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

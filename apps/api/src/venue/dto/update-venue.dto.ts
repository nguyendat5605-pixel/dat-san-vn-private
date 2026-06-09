// ============================================================
// DatSanVN — Update Venue DTO
// All fields optional (partial update)
// ============================================================

import { PartialType } from '@nestjs/mapped-types';
import { CreateVenueDto } from './create-venue.dto';

export class UpdateVenueDto extends PartialType(CreateVenueDto) {}

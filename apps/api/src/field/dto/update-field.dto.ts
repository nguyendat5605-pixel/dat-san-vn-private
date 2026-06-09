// ============================================================
// DatSanVN — Update Field DTO
// All fields optional (partial update)
// ============================================================

import { PartialType } from '@nestjs/mapped-types';
import { CreateFieldDto } from './create-field.dto';

export class UpdateFieldDto extends PartialType(CreateFieldDto) {}

// ============================================================
// DatSanVN — FieldModule
// Provides field (sân con) CRUD functionality
// ============================================================

import { Module } from '@nestjs/common';
import { FieldController } from './field.controller.js';
import { FieldService } from './field.service.js';
import { VenueModule } from '../venue/venue.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { SlotsModule } from '../slots/slots.module.js';

@Module({
  imports: [VenueModule, AuthModule, SlotsModule],
  controllers: [FieldController],
  providers: [FieldService],
  exports: [FieldService],
})
export class FieldModule {}

// ============================================================
// DatSanVN — AdminModule
// Admin endpoints for system management (ADMIN role only)
// PrismaModule is @Global() — no need to import explicitly
// ============================================================

import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';
import { SlotsModule } from '../slots/slots.module.js';

@Module({
  imports: [SlotsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}

// ============================================================
// DatSanVN — PrismaModule
// Global module, export PrismaService cho toàn app
// ============================================================

import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}

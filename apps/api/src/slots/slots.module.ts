import { Module } from '@nestjs/common';
import { SlotGenerationService } from './slot-generation.service.js';

@Module({
  providers: [SlotGenerationService],
  exports: [SlotGenerationService],
})
export class SlotsModule {}


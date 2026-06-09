import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller.js';
import { UploadStorageService } from './upload-storage.service.js';

@Module({
  controllers: [UploadController],
  providers: [UploadStorageService],
  exports: [UploadStorageService],
})
export class UploadModule {}

// ============================================================
// DatSanVN — UploadController
// Handles image file uploads via Multer memory storage
// ============================================================

import {
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
  ParseFilePipe,
  MaxFileSizeValidator,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { fileTypeFromBuffer } from 'file-type';
import { ClerkAuthGuard } from '../auth/guards/clerk-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '@prisma/client';
import { UploadStorageService } from './upload-storage.service.js';

/**
 * Max file size: 5 MB
 */
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Map<string, string>([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

@Controller('upload')
@UseGuards(ClerkAuthGuard, RolesGuard)
export class UploadController {
  private readonly logger = new Logger(UploadController.name);

  constructor(private readonly uploadStorageService: UploadStorageService) {}

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE },
    }),
  )
  async uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: MAX_FILE_SIZE })],
      }),
    )
    file: Express.Multer.File,
  ) {
    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('File upload không hợp lệ.');
    }

    const detected = await fileTypeFromBuffer(file.buffer);
    const extension = detected
      ? ALLOWED_IMAGE_TYPES.get(detected.mime)
      : undefined;

    if (!extension) {
      this.logger.warn(
        `[upload] Rejected file originalName=${file.originalname} declaredMime=${file.mimetype} detectedMime=${detected?.mime ?? 'unknown'}`,
      );
      throw new BadRequestException(
        'Loại file không hợp lệ. Chỉ chấp nhận JPG, PNG, WebP.',
      );
    }

    return this.uploadStorageService.uploadImage(
      file.buffer,
      detected!.mime,
      extension,
    );
  }
}

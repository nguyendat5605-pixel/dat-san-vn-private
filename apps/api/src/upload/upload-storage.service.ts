import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { dirname, relative, resolve, sep } from 'path';

type UploadStorageDriver = 'local' | 'supabase';

export interface StoredUpload {
  url: string;
  key: string;
}

const LOCAL_UPLOAD_DIR = resolve(process.cwd(), 'uploads');
const VENUE_IMAGE_KEY_PATTERN =
  /^venues\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/i;

@Injectable()
export class UploadStorageService implements OnModuleInit {
  private readonly logger = new Logger(UploadStorageService.name);
  private readonly driver: UploadStorageDriver;
  private supabase?: SupabaseClient;

  constructor(private readonly configService: ConfigService) {
    this.driver = this.resolveDriver();
  }

  onModuleInit() {
    if (this.driver === 'supabase') {
      this.validateSupabaseConfig();
      this.logger.log(
        `Upload storage enabled via Supabase bucket=${this.getRequiredConfig('SUPABASE_STORAGE_BUCKET')}`,
      );
      return;
    }

    if (this.isProduction()) {
      throw new Error(
        'Local upload storage is not allowed in production. Set UPLOAD_STORAGE_DRIVER=supabase and configure Supabase Storage.',
      );
    }

    this.logger.warn(
      `Upload storage using local disk at ${LOCAL_UPLOAD_DIR}. This is development-only and not safe for production.`,
    );
  }

  async uploadImage(
    buffer: Buffer,
    detectedMime: string,
    extension: string,
  ): Promise<StoredUpload> {
    const key = `venues/${randomUUID()}.${extension}`;

    if (this.driver === 'supabase') {
      return this.uploadToSupabase(key, buffer, detectedMime);
    }

    return this.uploadToLocalDisk(key, buffer);
  }

  async deleteImage(key: string): Promise<void> {
    if (!this.isSafeVenueImageKey(key)) {
      this.logger.warn(`Skipped unsafe venue image delete key=${key}`);
      return;
    }

    if (this.driver === 'supabase') {
      await this.deleteFromSupabase(key);
      return;
    }

    await this.deleteFromLocalDisk(key);
  }

  getKeyFromUrl(url: string): string | null {
    if (!url.trim()) {
      return null;
    }

    const keyFromConfiguredPublicUrl = this.getKeyFromConfiguredPublicUrl(url);
    if (keyFromConfiguredPublicUrl) {
      return keyFromConfiguredPublicUrl;
    }

    try {
      const parsed = new URL(url);
      const bucket = this.configService.get<string>('SUPABASE_STORAGE_BUCKET');
      const publicObjectPrefix = bucket
        ? `/storage/v1/object/public/${bucket}/`
        : '/storage/v1/object/public/';
      const localUploadPrefix = '/uploads/';
      const key = parsed.pathname.includes(publicObjectPrefix)
        ? parsed.pathname.slice(
            parsed.pathname.indexOf(publicObjectPrefix) +
              publicObjectPrefix.length,
          )
        : parsed.pathname.includes(localUploadPrefix)
          ? parsed.pathname.slice(
              parsed.pathname.indexOf(localUploadPrefix) +
                localUploadPrefix.length,
            )
          : null;

      return key ? this.normalizeVenueImageKey(key) : null;
    } catch {
      const key = url.startsWith('/uploads/')
        ? url.slice('/uploads/'.length)
        : null;

      return key ? this.normalizeVenueImageKey(key) : null;
    }
  }

  private async uploadToSupabase(
    key: string,
    buffer: Buffer,
    detectedMime: string,
  ): Promise<StoredUpload> {
    const bucket = this.getRequiredConfig('SUPABASE_STORAGE_BUCKET');
    const { error } = await this.getSupabase()
      .storage.from(bucket)
      .upload(key, buffer, {
        contentType: detectedMime,
        cacheControl: '31536000',
        upsert: false,
      });

    if (error) {
      this.logger.error(
        `Supabase upload failed for key=${key}: ${error.message}`,
      );
      throw new ServiceUnavailableException('Không thể upload ảnh lúc này.');
    }

    return {
      key,
      url: this.getPublicUrl(key),
    };
  }

  private async uploadToLocalDisk(
    key: string,
    buffer: Buffer,
  ): Promise<StoredUpload> {
    const targetPath = resolve(LOCAL_UPLOAD_DIR, key);
    await mkdir(dirname(targetPath), { recursive: true });
    await writeFile(targetPath, buffer, { flag: 'wx' });

    return {
      key,
      url: `/uploads/${key}`,
    };
  }

  private async deleteFromSupabase(key: string) {
    const bucket = this.getRequiredConfig('SUPABASE_STORAGE_BUCKET');
    const { error } = await this.getSupabase()
      .storage.from(bucket)
      .remove([key]);

    if (error) {
      this.logger.warn(
        `Supabase venue image delete failed for key=${key}: ${error.message}`,
      );
      return;
    }

    this.logger.log(`Deleted Supabase venue image key=${key}`);
  }

  private async deleteFromLocalDisk(key: string) {
    const targetPath = resolve(LOCAL_UPLOAD_DIR, key);
    const relativeTarget = relative(LOCAL_UPLOAD_DIR, targetPath);

    if (
      relativeTarget.startsWith('..') ||
      relativeTarget === '..' ||
      relativeTarget.startsWith(`..${sep}`)
    ) {
      this.logger.warn(
        `Skipped local venue image delete outside upload root key=${key}`,
      );
      return;
    }

    try {
      await unlink(targetPath);
      this.logger.log(`Deleted local venue image key=${key}`);
    } catch (error) {
      if (this.isNodeError(error) && error.code === 'ENOENT') {
        this.logger.warn(`Venue image already missing key=${key}`);
        return;
      }

      this.logger.warn(
        `Local venue image delete failed for key=${key}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private getSupabase() {
    if (!this.supabase) {
      this.supabase = createClient(
        this.getRequiredConfig('SUPABASE_URL'),
        this.getRequiredConfig('SUPABASE_SERVICE_ROLE_KEY'),
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        },
      );
    }

    return this.supabase;
  }

  private getPublicUrl(key: string) {
    const configuredPublicUrl = this.configService.get<string>(
      'SUPABASE_STORAGE_PUBLIC_URL',
    );

    if (configuredPublicUrl?.trim()) {
      return `${configuredPublicUrl.replace(/\/+$/, '')}/${key}`;
    }

    const bucket = this.getRequiredConfig('SUPABASE_STORAGE_BUCKET');
    const { data } = this.getSupabase().storage.from(bucket).getPublicUrl(key);
    return data.publicUrl;
  }

  private getKeyFromConfiguredPublicUrl(url: string) {
    const configuredPublicUrl = this.configService.get<string>(
      'SUPABASE_STORAGE_PUBLIC_URL',
    );

    if (!configuredPublicUrl?.trim()) {
      return null;
    }

    const prefix = `${configuredPublicUrl.trim().replace(/\/+$/, '')}/`;

    if (!url.startsWith(prefix)) {
      return null;
    }

    return this.normalizeVenueImageKey(url.slice(prefix.length));
  }

  private normalizeVenueImageKey(key: string) {
    try {
      const normalized = decodeURIComponent(key).replace(/\\/g, '/');
      return this.isSafeVenueImageKey(normalized) ? normalized : null;
    } catch {
      return null;
    }
  }

  private isSafeVenueImageKey(key: string) {
    return VENUE_IMAGE_KEY_PATTERN.test(key);
  }

  private resolveDriver(): UploadStorageDriver {
    const configured = this.configService
      .get<string>('UPLOAD_STORAGE_DRIVER')
      ?.trim()
      .toLowerCase();

    if (configured === 'local' || configured === 'supabase') {
      return configured;
    }

    if (configured) {
      throw new Error(
        'UPLOAD_STORAGE_DRIVER must be either "local" or "supabase".',
      );
    }

    return this.isProduction() ? 'supabase' : 'local';
  }

  private validateSupabaseConfig() {
    this.getRequiredConfig('SUPABASE_URL');
    this.getRequiredConfig('SUPABASE_SERVICE_ROLE_KEY');
    this.getRequiredConfig('SUPABASE_STORAGE_BUCKET');
  }

  private getRequiredConfig(key: string) {
    const value = this.configService.get<string>(key);

    if (!value?.trim()) {
      throw new Error(`${key} is required for Supabase upload storage.`);
    }

    return value.trim();
  }

  private isProduction() {
    return this.configService.get<string>('NODE_ENV') === 'production';
  }

  private isNodeError(error: unknown): error is NodeJS.ErrnoException {
    return error instanceof Error && 'code' in error;
  }
}

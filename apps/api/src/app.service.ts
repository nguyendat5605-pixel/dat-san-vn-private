import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma/prisma.service';
import {
  createRedisClient,
  describeRedisRuntimeConfig,
} from './config/redis.config.js';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  getHello(): string {
    return 'DatSanVN API is running!';
  }

  /**
   * Health check — runs a raw SQL query to verify DB connectivity.
   * Returns status, timestamp, and database connection state.
   */
  async checkHealth(): Promise<{
    status: string;
    timestamp: string;
    database: string;
    redis: {
      status: string;
      mode?: string;
      host?: string;
      port?: number;
      db?: number;
      tlsEnabled?: boolean;
    };
    uptime: number;
  }> {
    let dbStatus = 'disconnected';
    let redisStatus = 'disconnected';
    let redisDiagnostics: {
      mode?: string;
      host?: string;
      port?: number;
      db?: number;
      tlsEnabled?: boolean;
    } = {};

    try {
      await this.prisma.$queryRaw`SELECT 1 AS ok`;
      dbStatus = 'connected';
    } catch (error) {
      this.logger.error('Health check: DB connection failed', error);
      dbStatus = 'disconnected';
    }

    try {
      redisDiagnostics = describeRedisRuntimeConfig(this.configService);
      const redis = createRedisClient(this.configService, 'health-check', {
        connectTimeout: 500,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
      });
      redis.on('error', () => undefined);

      try {
        await redis.ping();
        redisStatus = 'connected';
      } finally {
        redis.disconnect();
      }
    } catch (error) {
      this.logger.error('Health check: Redis connection failed', error);
      redisStatus = 'disconnected';
    }

    return {
      status:
        dbStatus === 'connected' && redisStatus === 'connected'
          ? 'ok'
          : 'degraded',
      timestamp: new Date().toISOString(),
      database: dbStatus,
      redis: {
        status: redisStatus,
        ...redisDiagnostics,
      },
      uptime: process.uptime(),
    };
  }
}

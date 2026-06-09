// ============================================================
// DatSanVN — PrismaService (Serverless-safe singleton)
// Tránh tạo quá nhiều connection khi hot-reload (dev)
// hoặc cold-start liên tục trên Vercel (prod)
// ============================================================

import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import type { PoolConfig } from 'pg';

// Cache PrismaClient trên globalThis để tránh connection exhaustion
// khi dev server hot-reload hoặc serverless cold-start
const globalForPrisma = globalThis as unknown as {
  __prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('[PrismaService] Missing required env var: DATABASE_URL');
  }

  const poolMax = Number.parseInt(process.env.DB_POOL_MAX ?? '', 10);
  const poolConfig: PoolConfig = {
    connectionString,
    ...(Number.isInteger(poolMax) && poolMax > 0 ? { max: poolMax } : {}),
  };

  const adapter = new PrismaPg(poolConfig);
  return new PrismaClient({ adapter });
}

@Injectable()
export class PrismaService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly client: PrismaClient;

  constructor() {
    if (!globalForPrisma.__prisma) {
      globalForPrisma.__prisma = createPrismaClient();
    }

    this.client = globalForPrisma.__prisma;

    return new Proxy(this, {
      get: (target, property, receiver) => {
        if (property in target) {
          return Reflect.get(target, property, receiver);
        }

        const value = Reflect.get(this.client, property, this.client);
        return typeof value === 'function' ? value.bind(this.client) : value;
      },
    });
  }

  async onModuleInit() {
    await this.client.$connect();
    this.logger.log('Connected to database');
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
    this.logger.log('Disconnected from database');
  }
}

export interface PrismaService extends PrismaClient {}

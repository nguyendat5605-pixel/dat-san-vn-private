// apps/api/prisma.config.ts
// ============================================================
// Prisma 7 Config — Neon PostgreSQL
// CLI (migrate, db push) dùng DIRECT_URL (non-pooler)
// Runtime (PrismaClient) dùng DATABASE_URL (pooler) qua adapter
// ============================================================
import dotenv from "dotenv";
dotenv.config();   // Load .env trước khi Prisma đọc

import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "./prisma/schema.prisma",

  datasource: {
    // CLI dùng DIRECT_URL (non-pooler) cho migrations
    // PrismaClient runtime dùng DATABASE_URL (pooler) qua PrismaPg adapter
    url: env("DIRECT_URL"),
  },

  migrations: {
    path: "./prisma/migrations",
  },
});
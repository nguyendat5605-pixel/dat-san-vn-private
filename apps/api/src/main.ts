import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { Logger, ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { TransformInterceptor } from './common/interceptors/transform.interceptor.js';

async function bootstrap() {
  /**
   * Enable rawBody: true so NestJS preserves the raw Buffer on req.rawBody.
   *
   * This is required by the @RawBody() decorator used in ClerkWebhookController.
   * Svix needs the EXACT raw bytes for HMAC-SHA256 signature verification —
   * a parsed/re-serialized JSON object would produce a different hash and fail.
   *
   * NestJS docs: https://docs.nestjs.com/faq/raw-body
   */
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });

  app.enableShutdownHooks();

  const logger = new Logger('Bootstrap');

  // ── Global pipes ────────────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,       // Strip unknown properties
      forbidNonWhitelisted: true,
      transform: true,       // Auto-transform payloads to DTO instances
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // ── CORS ────────────────────────────────────────────────────────────────────
  const allowedOrigins = (process.env.FRONTEND_URLS ?? process.env.FRONTEND_URL ?? 'http://localhost:3001')
    .split(',')
    .map((origin) => origin.replace(/"/g, '').trim())
    .filter(Boolean);

  logger.log(`Allowed CORS origins: ${JSON.stringify(allowedOrigins)}`);

  app.enableCors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      logger.error(`CORS blocked origin: ${origin}`);
      return callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
  });

  // ── Global prefix (exclude webhooks so path stays /webhooks/clerk) ──────────
  app.setGlobalPrefix('api', {
    exclude: ['webhooks/(.*)', 'health', 'uploads/(.*)'],
  });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 DatSanVN API running on: http://0.0.0.0:${port}/api`);
  logger.log(`🔗 Clerk webhook endpoint: POST http://localhost:${port}/webhooks/clerk`);
}

bootstrap();

import { createParamDecorator, ExecutionContext, Logger } from '@nestjs/common';
import { Request } from 'express';

const logger = new Logger('RawBody');

/**
 * @RawBody() decorator
 *
 * Extracts the raw Buffer from the Express request for Svix signature verification.
 *
 * Svix requires the EXACT raw bytes of the request body — not a parsed/re-serialized
 * JSON object, which would produce a different HMAC-SHA256 hash and fail verification.
 *
 * How raw body becomes available (two methods, both supported):
 *
 *  Method 1 – NestJS built-in (RECOMMENDED, already configured in main.ts):
 *    NestFactory.create(AppModule, { rawBody: true })
 *    → NestJS stores the raw buffer at `req.rawBody`
 *
 *  Method 2 – Express middleware (legacy):
 *    app.use('/webhooks/clerk', express.raw({ type: 'application/json' }))
 *    → Express stores the raw buffer directly at `req.body`
 *
 * Returns null if neither method populated a Buffer — controller must handle this.
 *
 * Usage in controller:
 *   async handleWebhook(@RawBody() rawBody: Buffer | null) { ... }
 */
export const RawBody = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Buffer | null => {
    const request = ctx.switchToHttp().getRequest<Request & { rawBody?: Buffer }>();

    // Priority 1: NestJS rawBody option (req.rawBody is set when rawBody: true in main.ts)
    if (Buffer.isBuffer(request.rawBody)) {
      return request.rawBody;
    }

    // Priority 2: Express raw() middleware (req.body is the raw Buffer)
    if (Buffer.isBuffer(request.body)) {
      return request.body;
    }

    // Neither method produced a Buffer — this is a misconfiguration
    logger.error(
      '[RawBody] Raw body is not a Buffer. ' +
        'Ensure `rawBody: true` is set in NestFactory.create() options in main.ts. ' +
        `Got: ${typeof request.rawBody !== 'undefined' ? typeof request.rawBody : 'undefined'} on rawBody, ` +
        `${typeof request.body} on body.`,
    );

    return null;
  },
);

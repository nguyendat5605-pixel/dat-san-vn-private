import {
  Controller,
  Post,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  HttpException,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ClerkWebhookService } from './clerk-webhook.service.js';
import { RawBody } from '../../common/decorators/raw-body.decorator.js';
import type { SupportedClerkEvent } from './dto/index.js';

/**
 * ClerkWebhookController
 *
 * Exposes: POST /webhooks/clerk
 *
 * Request flow:
 *  1. Extract raw body Buffer  → required for Svix HMAC-SHA256 verification
 *  2. Verify Svix signature    → reject invalid requests without processing
 *  3. Route to service handler → upsert/delete user in DB
 *  4. Return HTTP 200 only after successful processing
 *
 * Route registration:
 *  - Global prefix 'api' is set in main.ts
 *  - The prefix excludes 'webhooks/(.*)' so this endpoint is at /webhooks/clerk
 *    NOT /api/webhooks/clerk
 *
 * Authentication:
 *  - No JWT/session guard needed — Svix HMAC signature IS the auth
 *  - Invalid signatures are logged and rejected before any DB work
 *
 * Retry behavior:
 *  - Verification/payload errors are non-retryable and return 400
 *  - Processing errors are retryable and return 503 so Clerk retries delivery
 */
@Controller('webhooks/clerk')
export class ClerkWebhookController {
  private readonly logger = new Logger(ClerkWebhookController.name);

  constructor(private readonly clerkWebhookService: ClerkWebhookService) {}

  /**
   * POST /webhooks/clerk
   *
   * @param rawBody  Raw request body Buffer — populated by `rawBody: true` in main.ts
   * @param headers  All request headers — Svix requires svix-id, svix-timestamp, svix-signature
   * @returns        { received: boolean; message?: string }
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @RawBody() rawBody: Buffer | null,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ): Promise<{ received: boolean; message?: string }> {
    // ── Guard: raw body must be a Buffer for Svix to verify ────────────────
    if (!rawBody) {
      this.logger.error(
        '[Webhook] Raw body is null — rawBody: true may not be set in NestFactory.create().',
      );
      throw new InternalServerErrorException('Server misconfiguration: raw body unavailable');
    }

    // ── Step 1: Verify Svix signature ──────────────────────────────────────
    let event: SupportedClerkEvent;

    try {
      /**
       * verifySignature() uses Svix to:
       *  a) Recompute HMAC-SHA256 over (svix-id + "." + svix-timestamp + "." + rawBody)
       *  b) Compare to svix-signature header
       *  c) Validate timestamp is within ±5 minutes (anti-replay)
       *
       * Throws WebhookVerificationError on any failure.
       */
      event = this.clerkWebhookService.verifySignature(rawBody, headers);
    } catch (error) {
      // Signature invalid, expired, or wrong secret → not a legitimate Clerk request
      this.logger.warn(
        `[Webhook] Verification failed eventType=unknown clerkUserId=unknown cause=${this.failureCause(error)}`,
      );

      throw new BadRequestException('Invalid Clerk webhook signature or payload');
    }

    const clerkUserId = this.getClerkUserId(event);

    this.logger.log(
      `[Webhook] Verified eventType=${event.type} clerkUserId=${clerkUserId}`,
    );

    // ── Step 2: Handle the event ───────────────────────────────────────────
    try {
      await this.clerkWebhookService.handleEvent(event);

      this.logger.log(
        `[Webhook] Processed eventType=${event.type} clerkUserId=${clerkUserId}`,
      );
      return { received: true };
    } catch (error) {
      this.logger.error(
        `[Webhook] Processing failed eventType=${event.type} clerkUserId=${clerkUserId} cause=${this.failureCause(error)}`,
        error instanceof Error ? error.stack : String(error),
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new ServiceUnavailableException(
        `Webhook processing failed for event "${event.type}"`,
      );
    }
  }

  private getClerkUserId(event: SupportedClerkEvent): string {
    return event.data.id;
  }

  private failureCause(error: unknown): string {
    if (error instanceof Error) {
      return `${error.name}: ${error.message}`;
    }

    return String(error);
  }
}

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Webhook } from 'svix';
import { UserService } from '../../user/user.service.js';
import {
  type ClerkUserData,
  type ClerkDeletedData,
  type SupportedClerkEvent,
  type ClerkUserCreatedEvent,
  type ClerkUserUpdatedEvent,
  type ClerkUserDeletedEvent,
  isSupportedClerkEvent,
} from './dto/index.js';

/**
 * ClerkWebhookService
 *
 * Handles all business logic for Clerk webhook events.
 *
 * Architecture:
 *  - verifySignature(): uses Svix to verify HMAC-SHA256 + timestamp
 *  - handleEvent(): routes to per-event handler using discriminated union
 *  - User sync operations are delegated to UserService (single source of truth)
 *
 * Design decisions:
 *  - verifySignature() throws on invalid; controller rejects invalid requests
 *    before any state changes
 *  - user.deleted is a SOFT delete — keeps DB row for FK integrity
 *  - Role is never overwritten on update (managed by our own admin flows)
 *
 * Svix verification requires:
 *  - Raw body as Buffer or string (NOT parsed JSON)
 *  - Three headers: svix-id, svix-timestamp, svix-signature
 *  - A clock within 5 minutes of the timestamp header (anti-replay)
 */
@Injectable()
export class ClerkWebhookService {
  private readonly logger = new Logger(ClerkWebhookService.name);

  /**
   * Svix Webhook instance — initialized once with the signing secret.
   * Reused for every incoming request (stateless, thread-safe).
   */
  private readonly webhook: Webhook;

  constructor(
    private readonly userService: UserService,
    private readonly configService: ConfigService,
  ) {
    /**
     * Pull secret from ConfigService.
     *
     * Works with either:
     *   - Flat env var:      configService.get<string>('CLERK_WEBHOOK_SECRET')
     *   - Namespaced config: configService.get<string>('clerk.webhookSecret')
     *     (requires clerkConfig loaded in ConfigModule.forRoot({ load: [clerkConfig] }))
     *
     * We use the flat key for simplicity — both map to the same env var.
     */
    const secret = this.configService.get<string>('CLERK_WEBHOOK_SECRET');

    if (!secret || secret.startsWith('whsec_YOUR')) {
      this.logger.warn(
        '[ClerkWebhookService] CLERK_WEBHOOK_SECRET not configured — webhook verification disabled.',
      );
      return;
    }

    this.webhook = new Webhook(secret);
  }

  // ─── Signature Verification ────────────────────────────────────────────────

  /**
   * Verifies the Clerk webhook signature using the Svix library.
   *
   * HOW SVIX VERIFICATION WORKS:
   *  1. Extracts three required headers: svix-id, svix-timestamp, svix-signature
   *  2. Recomputes HMAC-SHA256( svix-id + "." + svix-timestamp + "." + rawBody )
   *  3. Compares to the `svix-signature` header value (base64url encoded)
   *  4. Checks timestamp is within ±5 minutes to prevent replay attacks
   *
   *  ⚠️  rawBody MUST be the original Buffer/string from the HTTP request.
   *      A re-serialized JSON would produce a different hash → verification fails.
   *
   * @param rawBody  Raw Buffer from Express (populated by rawBody:true in main.ts)
   * @param headers  Full request headers (svix-id/timestamp/signature are extracted here)
   * @returns        Verified, parsed SupportedClerkEvent — safe to use
   * @throws         WebhookVerificationError if signature/timestamp is invalid
   */
  verifySignature(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): SupportedClerkEvent {
    /**
     * Extract the three Svix-specific headers required for verification.
     * Headers from NestJS @Headers() may be arrays (multi-value); take the first.
     */
    const svixId = this.extractHeader(headers, 'svix-id');
    const svixTimestamp = this.extractHeader(headers, 'svix-timestamp');
    const svixSignature = this.extractHeader(headers, 'svix-signature');

    this.logger.debug(
      `[Verify] svix-id=${svixId} svix-timestamp=${svixTimestamp}`,
    );

    // Svix verify() throws WebhookVerificationError on any failure.
    // It returns the parsed payload as `object` — we must narrow the type ourselves.
    const payload: unknown = this.webhook.verify(rawBody, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    });

    /**
     * Runtime type guard: ensure Svix returned a shape we actually handle.
     * This catches unknown event types (e.g. organization.created) that Clerk
     * might send if the webhook endpoint is misconfigured to receive all events.
     */
    if (!isSupportedClerkEvent(payload)) {
      const eventType =
        typeof payload === 'object' && payload !== null
          ? String((payload as Record<string, unknown>)['type'] ?? 'unknown')
          : 'non-object';

      throw new Error(
        `[Verify] Unsupported or malformed event type: "${eventType}". ` +
        'Only user.created, user.updated, user.deleted are handled.',
      );
    }

    this.logger.log(`[Verify] Signature OK — event type: ${payload.type}`);
    return payload;
  }

  // ─── Event Routing ─────────────────────────────────────────────────────────

  /**
   * Routes a verified Clerk event to the appropriate handler.
   *
   * Uses TypeScript discriminated union narrowing — after checking `event.type`,
   * TypeScript knows the exact shape of `event.data` without any cast.
   */
  async handleEvent(event: SupportedClerkEvent): Promise<void> {
    switch (event.type) {
      case 'user.created':
        await this.handleUserCreated(event);
        break;

      case 'user.updated':
        await this.handleUserUpdated(event);
        break;

      case 'user.deleted':
        await this.handleUserDeleted(event);
        break;

      default: {
        // Exhaustiveness check — unreachable with correct SupportedClerkEvent union
        const _exhaustiveCheck: never = event;
        this.logger.warn(
          `[handleEvent] Unhandled event type: ${String((_exhaustiveCheck as SupportedClerkEvent).type)}`,
        );
      }
    }
  }

  // ─── Handlers ──────────────────────────────────────────────────────────────

  /**
   * user.created — Upsert user into our database via UserService.
   *
   * Delegates to UserService.syncFromClerk() for idempotent upsert.
   * Default role = PLAYER. Role is only changed via our admin flows.
   *
   * @param event  Narrowed ClerkUserCreatedEvent (data is ClerkUserData)
   */
  private async handleUserCreated(event: ClerkUserCreatedEvent): Promise<void> {
    const data: ClerkUserData = event.data;

    if (!this.hasPrimaryEmail(data)) {
      this.logger.warn(
        `[user.created] No primary email for clerkId=${data.id}. ` +
        'User cannot be created without an email.',
      );
      throw new BadRequestException('Clerk user is missing a primary email');
    }

    try {
      const user = await this.userService.syncFromClerk(data);
      this.logger.log(
        `[user.created] Synced → id=${user.id} clerkId=${data.id} email=${user.email}`,
      );
    } catch (error) {
      this.logger.error(
        `[user.created] Failed to sync clerkId=${data.id}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * user.updated — Sync profile changes from Clerk to our DB via UserService.
   *
   * @param event  Narrowed ClerkUserUpdatedEvent (data is ClerkUserData)
   */
  private async handleUserUpdated(event: ClerkUserUpdatedEvent): Promise<void> {
    const data: ClerkUserData = event.data;

    try {
      const user = await this.userService.syncFromClerk(data);
      this.logger.log(
        `[user.updated] Synced → id=${user.id} clerkId=${data.id}`,
      );
    } catch (error) {
      this.logger.error(
        `[user.updated] Failed for clerkId=${data.id}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * user.deleted — Soft-delete the user via UserService.
   *
   * @param event  Narrowed ClerkUserDeletedEvent (data is ClerkDeletedData)
   */
  private async handleUserDeleted(event: ClerkUserDeletedEvent): Promise<void> {
    const data: ClerkDeletedData = event.data;

    try {
      await this.userService.softDeleteByClerkId(data.id);
      this.logger.log(`[user.deleted] Processed for clerkId=${data.id}`);
    } catch (error) {
      this.logger.error(
        `[user.deleted] Failed for clerkId=${data.id}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  /**
   * Checks if the user has a primary email set.
   */
  private hasPrimaryEmail(data: ClerkUserData): boolean {
    if (!data.primary_email_address_id) return false;

    return data.email_addresses.some(
      (e) => e.id === data.primary_email_address_id,
    );
  }

  /**
   * Safely extracts a single string value from a raw header.
   *
   * NestJS @Headers() returns headers as Record<string, string | string[] | undefined>.
   * Multi-value headers (rare, but possible) come as arrays — we take the first.
   * Missing headers return '' — Svix will then fail verification with a clear error.
   */
  private extractHeader(
    headers: Record<string, string | string[] | undefined>,
    key: string,
  ): string {
    const value = headers[key];
    if (Array.isArray(value)) return value[0] ?? '';
    return value ?? '';
  }
}

/**
 * DTOs & Type Guards for Clerk Webhook events.
 *
 * Clerk sends ALL events in a standardized envelope:
 *   { type: string, data: <event-specific-object>, object: 'event', timestamp: number }
 *
 * We handle exactly 3 events:
 *   - user.created  → data is ClerkUserData
 *   - user.updated  → data is ClerkUserData
 *   - user.deleted  → data is ClerkDeletedData
 *
 * Clerk docs: https://clerk.com/docs/integrations/webhooks/overview
 * Payload reference: https://clerk.com/docs/references/backend/types/backend-user
 */

// ─── Sub-types ────────────────────────────────────────────────────────────────

export interface ClerkEmailAddress {
  id: string;
  email_address: string;
  verification: {
    status: 'verified' | 'unverified' | 'transferable' | 'failed' | 'expired';
    strategy: string;
  } | null;
}

export interface ClerkPhoneNumber {
  id: string;
  phone_number: string;
  verification: {
    status: 'verified' | 'unverified';
  } | null;
}

// ─── Clerk User Data (embedded in user.created / user.updated) ───────────────

/**
 * Shape of `data` for user.created and user.updated events.
 * Maps directly to Clerk's User object.
 */
export interface ClerkUserData {
  /** Clerk user ID — e.g. "user_2abc..." */
  id: string;

  /** All email addresses attached to this user */
  email_addresses: ClerkEmailAddress[];

  /** Points to the primary email in email_addresses[].id */
  primary_email_address_id: string | null;

  /** All phone numbers attached to this user */
  phone_numbers: ClerkPhoneNumber[];

  /** Points to the primary phone in phone_numbers[].id */
  primary_phone_number_id: string | null;

  first_name: string | null;
  last_name: string | null;

  /** Full CDN URL of the user's profile image */
  image_url: string | null;

  username: string | null;

  /** Unix timestamp (milliseconds) when user was created in Clerk */
  created_at: number;

  /** Unix timestamp (milliseconds) when user was last updated in Clerk */
  updated_at: number;
}

// ─── Clerk Deleted User Data (embedded in user.deleted) ──────────────────────

/**
 * Shape of `data` for user.deleted events.
 * Clerk sends a minimal object — only id is guaranteed.
 */
export interface ClerkDeletedData {
  /** Clerk user ID of the deleted user */
  id: string;
  object: 'user';
  deleted: true;
}

// ─── Supported Event Types ───────────────────────────────────────────────────

export type ClerkWebhookEventType =
  | 'user.created'
  | 'user.updated'
  | 'user.deleted';

// ─── Typed Event Variants (Discriminated Union) ───────────────────────────────

/**
 * user.created — Clerk fires this once when a new user registers.
 * data is the full ClerkUserData object.
 */
export interface ClerkUserCreatedEvent {
  type: 'user.created';
  data: ClerkUserData;
  object: 'event';
  timestamp: number;
}

/**
 * user.updated — Clerk fires this when profile info changes.
 * data is the updated ClerkUserData object.
 */
export interface ClerkUserUpdatedEvent {
  type: 'user.updated';
  data: ClerkUserData;
  object: 'event';
  timestamp: number;
}

/**
 * user.deleted — Clerk fires this when a user is deleted.
 * data is the minimal ClerkDeletedData object (NOT the full user).
 */
export interface ClerkUserDeletedEvent {
  type: 'user.deleted';
  data: ClerkDeletedData;
  object: 'event';
  timestamp: number;
}

/**
 * Union of all supported Clerk webhook events.
 * TypeScript can narrow the type of `data` using the `type` discriminant.
 *
 * Example:
 *   if (event.type === 'user.created') {
 *     event.data // ClerkUserData ✓
 *   }
 */
export type SupportedClerkEvent =
  | ClerkUserCreatedEvent
  | ClerkUserUpdatedEvent
  | ClerkUserDeletedEvent;

// ─── Runtime Type Guards ──────────────────────────────────────────────────────

/**
 * Validates that an unknown svix-verified payload is one of our supported events.
 * Svix verify() returns `object` — we must narrow it before using.
 *
 * Guards check only the `type` discriminant and basic shape — full schema
 * validation is out of scope for webhook throughput.
 */
export function isSupportedClerkEvent(payload: unknown): payload is SupportedClerkEvent {
  if (typeof payload !== 'object' || payload === null) return false;

  const p = payload as Record<string, unknown>;
  return (
    typeof p['type'] === 'string' &&
    typeof p['data'] === 'object' &&
    p['data'] !== null &&
    p['object'] === 'event' &&
    (p['type'] === 'user.created' ||
      p['type'] === 'user.updated' ||
      p['type'] === 'user.deleted')
  );
}

import { UserRole } from '@prisma/client';

/**
 * AuthUser — the shape of `req.user` after ClerkAuthGuard verifies the JWT.
 *
 * Attached to the Express request by ClerkAuthGuard.canActivate().
 * Consumed by:
 *  - RolesGuard      → reads `role` to check against @Roles()
 *  - @CurrentUser()   → extracts user or specific field from request
 *  - Controller logic → uses `id` for ownership checks, queries, etc.
 *
 * This is our INTERNAL user representation, NOT the Clerk JWT payload.
 * ClerkAuthGuard maps Clerk's JWT claims → DB lookup → AuthUser.
 */
export interface AuthUser {
  /** Our database UUID (users.id) */
  id: string;

  /** Clerk user ID (e.g. "user_2abc...") — used for Clerk API calls */
  clerkId: string;

  /** User's primary email */
  email: string;

  /** User's role from our DB (PLAYER | OWNER | ADMIN) */
  role: UserRole;

  /** venueId[] where this user is an active STAFF member */
  staffVenueIds: string[];
}

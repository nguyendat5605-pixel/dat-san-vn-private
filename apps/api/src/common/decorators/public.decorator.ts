import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key used by ClerkAuthGuard to skip JWT verification.
 * @internal — used in guard logic, not in controllers.
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * @Public() decorator — marks a route as publicly accessible.
 *
 * When applied to a controller method (or entire controller),
 * ClerkAuthGuard will skip JWT verification and allow the request through.
 *
 * Use for:
 *  - Health check endpoints
 *  - Public venue listings
 *  - Any unauthenticated endpoint
 *
 * @example
 *   @Public()
 *   @Get('health')
 *   healthCheck() { ... }
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

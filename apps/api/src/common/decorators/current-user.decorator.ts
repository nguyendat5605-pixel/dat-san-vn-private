import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '../../auth/interfaces/auth-user.interface.js';

/**
 * @CurrentUser() decorator — extracts the authenticated user from the request.
 *
 * ClerkAuthGuard attaches `req.user` as an AuthUser object after JWT verification.
 * This decorator provides a clean way to access it in controller methods.
 *
 * Usage:
 *
 *   // Get entire user object
 *   @Get('me')
 *   getProfile(@CurrentUser() user: AuthUser) { ... }
 *
 *   // Get a specific field
 *   @Post()
 *   create(@CurrentUser('id') userId: string) { ... }
 *
 *   @Post()
 *   create(@CurrentUser('role') role: UserRole) { ... }
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthUser | undefined;

    if (!user) return undefined;

    return data ? user[data] : user;
  },
);

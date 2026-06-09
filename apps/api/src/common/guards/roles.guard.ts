// ============================================================
// DatSanVN — Roles Guard
// Checks user.role from request after ClerkAuthGuard sets req.user
// Works with @Roles() decorator to restrict route access
// ============================================================

import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import type { AuthUser } from '../../auth/interfaces/auth-user.interface.js';

/**
 * RolesGuard — checks if the authenticated user has the required role(s).
 *
 * Prerequisites:
 *  - Must be used AFTER ClerkAuthGuard (which sets req.user as AuthUser)
 *  - Route must be decorated with @Roles(UserRole.ADMIN, ...) to require roles
 *
 * Behavior:
 *  - No @Roles() decorator → allows all authenticated users
 *  - Has @Roles() but no req.user → blocks (returns false)
 *  - Has @Roles() and req.user.role matches → allows
 *
 * Usage:
 *   @UseGuards(ClerkAuthGuard, RolesGuard)
 *   @Roles(UserRole.ADMIN)
 *   @Get('admin-only')
 *   adminOnly() { ... }
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Không có @Roles() → cho qua (chỉ cần auth, không cần role cụ thể)
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // ClerkAuthGuard đã attach req.user là AuthUser
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser | undefined;

    // Chưa có user (chưa qua ClerkAuthGuard) → block
    if (!user) {
      return false;
    }

    return requiredRoles.includes(user.role);
  }
}

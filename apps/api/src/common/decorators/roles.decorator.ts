// ============================================================
// DatSanVN — Roles Decorator
// Dùng với RolesGuard để bảo vệ route theo role
// Roles: PLAYER | OWNER | ADMIN (từ @prisma/client)
// ============================================================

import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Decorator đánh dấu route yêu cầu role cụ thể.
 *
 * @example
 * @Roles(UserRole.ADMIN)
 * @Roles(UserRole.ADMIN, UserRole.OWNER)
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

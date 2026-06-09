import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole, StaffPermission } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { STAFF_PERMISSIONS_KEY } from '../decorators/staff-permissions.decorator.js';
import type { AuthUser } from '../../auth/interfaces/auth-user.interface.js';

/**
 * StaffGuard — venue-scoped authorization for OWNER + STAFF.
 *
 * Use on endpoints where both OWNER and STAFF are allowed,
 * but STAFF must hold specific permissions. ADMIN bypasses all.
 *
 * venueId is resolved from:
 *  1. route params (:venueId or :id)
 *  2. request body (body.venueId) — for routes like /bookings
 */
@Injectable()
export class StaffGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user: AuthUser = request.user;
    // venueId đến từ route param, hoặc body (cho booking routes)
    const venueId: string =
      request.params.venueId ?? request.params.id ?? request.body?.venueId;

    if (!venueId) {
      throw new ForbiddenException('Không xác định được venue.');
    }

    // ADMIN bypass tất cả
    if (user.role === UserRole.ADMIN) return true;

    // OWNER — chỉ bypass nếu sở hữu đúng venue này
    if (user.role === UserRole.OWNER) {
      const isOwner = await this.prisma.venueOwner.findFirst({
        where: { userId: user.id, venueId, status: 'APPROVED' },
      });
      if (isOwner) return true;
      throw new ForbiddenException('Bạn không sở hữu sân này.');
    }

    // STAFF — check venueId và permission
    if (!user.staffVenueIds?.includes(venueId)) {
      throw new ForbiddenException('Bạn không có quyền truy cập sân này.');
    }

    const requiredPermissions = this.reflector.get<StaffPermission[]>(
      STAFF_PERMISSIONS_KEY,
      context.getHandler(),
    );

    // Không yêu cầu permission cụ thể → chỉ cần là staff của venue
    if (!requiredPermissions?.length) return true;

    const staffRecord = await this.prisma.venueStaff.findUnique({
      where: { venueId_userId: { venueId, userId: user.id } },
      select: { permissions: true },
    });

    const hasAll = requiredPermissions.every((p) =>
      staffRecord?.permissions.includes(p),
    );

    if (!hasAll) {
      throw new ForbiddenException('Bạn không đủ quyền thực hiện thao tác này.');
    }

    return true;
  }
}

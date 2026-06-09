import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { StaffService } from './staff.service.js';
import { InviteStaffDto } from './dto/invite-staff.dto.js';
import { UpdateStaffDto } from './dto/update-staff.dto.js';
import { ClerkAuthGuard } from '../auth/guards/clerk-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { StaffGuard } from '../common/guards/staff.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { RequireStaffPermissions } from '../common/decorators/staff-permissions.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { UserRole, StaffPermission } from '@prisma/client';
import type { AuthUser } from '../auth/interfaces/auth-user.interface.js';

// Route prefix: /venues/:venueId/staff
@Controller('venues/:venueId/staff')
@UseGuards(ClerkAuthGuard)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  // OWNER xem danh sách staff
  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  getStaff(
    @Param('venueId', ParseUUIDPipe) venueId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.staffService.getStaffByVenue(venueId, user.id);
  }

  // OWNER mời nhân viên
  @Post('invite')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER)
  @HttpCode(HttpStatus.CREATED)
  invite(
    @Param('venueId', ParseUUIDPipe) venueId: string,
    @Body() dto: InviteStaffDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.staffService.inviteStaff(venueId, user.id, dto);
  }

  // OWNER cập nhật permission / disable staff
  @Patch(':staffId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER)
  update(
    @Param('venueId', ParseUUIDPipe) venueId: string,
    @Param('staffId', ParseUUIDPipe) staffId: string,
    @Body() dto: UpdateStaffDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.staffService.updateStaff(venueId, staffId, user.id, dto);
  }

  // OWNER xóa (soft) staff
  @Delete(':staffId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER)
  remove(
    @Param('venueId', ParseUUIDPipe) venueId: string,
    @Param('staffId', ParseUUIDPipe) staffId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.staffService.removeStaff(venueId, staffId, user.id);
  }

  // STAFF + OWNER xem doanh thu trong ca (chỉ ngày hôm nay)
  @Get('shift-revenue')
  @UseGuards(StaffGuard)
  @RequireStaffPermissions(StaffPermission.VIEW_SHIFT_REVENUE)
  getShiftRevenue(@Param('venueId', ParseUUIDPipe) venueId: string) {
    return this.staffService.getShiftRevenue(venueId);
  }
}

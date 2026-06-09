// ============================================================
// DatSanVN — AdminController
// All endpoints guarded: ClerkAuthGuard + RolesGuard(ADMIN)
// ============================================================

import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AdminService } from './admin.service.js';
import { ClerkAuthGuard } from '../auth/guards/clerk-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';

@Controller('admin')
@UseGuards(ClerkAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ── Stats ──────────────────────────────────────────────────

  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  // ── Users ──────────────────────────────────────────────────

  @Get('users')
  getUsers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.adminService.getUsers(page, limit);
  }

  @Patch('users/:id/role')
  updateUserRole(
    @Param('id') id: string,
    @Body('role') role: UserRole,
  ) {
    return this.adminService.updateUserRole(id, role);
  }

  @Delete('users/:id')
  deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(id);
  }

  @Patch('users/:id/activate')
  activateUser(@Param('id') id: string) {
    return this.adminService.activateUser(id);
  }

  // ── Venues ─────────────────────────────────────────────────

  @Get('venues')
  getVenues(@Query('status') status?: string) {
    return this.adminService.getVenues(status);
  }

  @Patch('venues/:id/approve')
  approveVenue(@Param('id') id: string) {
    return this.adminService.approveVenue(id);
  }

  @Patch('venues/:id/reject')
  rejectVenue(@Param('id') id: string) {
    return this.adminService.rejectVenue(id);
  }

  // ── Bookings ───────────────────────────────────────────────

  @Get('bookings')
  getAllBookings(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.adminService.getAllBookings(page, limit);
  }
}

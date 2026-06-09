import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Headers,
  Query,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { BookingService } from './booking.service.js';
import { CancelBookingDto, CreateBookingDto } from './dto/index.js';
import { ClerkAuthGuard } from '../auth/guards/clerk-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { StaffGuard } from '../common/guards/staff.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { RequireStaffPermissions } from '../common/decorators/staff-permissions.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { UserRole, StaffPermission } from '@prisma/client';
import type { AuthUser } from '../auth/interfaces/auth-user.interface.js';

@Controller('bookings')
@UseGuards(ClerkAuthGuard, RolesGuard)
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Post()
  @Roles(UserRole.PLAYER, UserRole.ADMIN, UserRole.OWNER)
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateBookingDto,
    @CurrentUser() user: AuthUser,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.bookingService.createBooking(
      user.id,
      {
        ...dto,
        isWalkIn: false,
      },
      idempotencyKey,
    );
  }

  @Get('me')
  getMyBookings(@CurrentUser() user: AuthUser) {
    return this.bookingService.getMyBookings(user.id);
  }

  @Get()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  getManagedBookings(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: string,
    @Query('date') date?: string,
  ) {
    return this.bookingService.getManagedBookings(user.id, user.role, { status, date });
  }

  @Post('cancel')
  @Roles(UserRole.PLAYER)
  @HttpCode(HttpStatus.OK)
  cancelMyBooking(@Body() dto: CancelBookingDto, @CurrentUser() user: AuthUser) {
    return this.bookingService.cancelMyBooking(dto, user.id);
  }

  @Post(':id/confirm')
  @Roles(UserRole.OWNER)
  @HttpCode(HttpStatus.OK)
  confirmBooking(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bookingService.confirmBooking(id, user.id);
  }

  @Patch(':id/confirm')
  @Roles(UserRole.OWNER)
  @HttpCode(HttpStatus.OK)
  confirmBookingViaPatch(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bookingService.confirmBooking(id, user.id);
  }

  @Patch(':id/confirm-manual-payment')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  confirmManualPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bookingService.confirmManualPayment(id, user.id, user.role);
  }

  @Post(':id/cancel-by-owner')
  @Roles(UserRole.OWNER)
  @HttpCode(HttpStatus.OK)
  cancelByOwner(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bookingService.cancelBooking(id, user.id, true);
  }

  @Post(':id/cancel')
  @Roles(UserRole.PLAYER, UserRole.OWNER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  cancelBooking(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bookingService.cancelBooking(id, user.id, user.role === UserRole.OWNER);
  }

  @Patch(':id/cancel')
  @Roles(UserRole.PLAYER, UserRole.OWNER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  cancelBookingViaPatch(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bookingService.cancelBooking(id, user.id, user.role === UserRole.OWNER);
  }

  // ── Staff endpoints ────────────────────────────────────────

  // STAFF confirm booking (phải có MANAGE_BOOKINGS)
  @Patch(':id/staff-confirm')
  @UseGuards(StaffGuard)
  @RequireStaffPermissions(StaffPermission.MANAGE_BOOKINGS)
  @HttpCode(HttpStatus.OK)
  staffConfirmBooking(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bookingService.confirmBooking(id, user.id);
  }

  // STAFF cancel booking
  @Patch(':id/staff-cancel')
  @UseGuards(StaffGuard)
  @RequireStaffPermissions(StaffPermission.MANAGE_BOOKINGS)
  @HttpCode(HttpStatus.OK)
  staffCancelBooking(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bookingService.cancelBooking(id, user.id, true);
  }

  // STAFF tạo walk-in booking (khách vãng lai)
  @Post('walk-in')
  @UseGuards(StaffGuard)
  @RequireStaffPermissions(StaffPermission.CREATE_WALK_IN)
  @HttpCode(HttpStatus.CREATED)
  createWalkIn(
    @Body() dto: CreateBookingDto,
    @CurrentUser() user: AuthUser,
  ) {
    // Walk-in: tạo booking với status CONFIRMED ngay, payment method CASH
    return this.bookingService.createBooking(user.id, {
      ...dto,
      isWalkIn: true,
    });
  }
}

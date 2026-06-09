// ============================================================
// DatSanVN — VenueController
// REST API for venue CRUD operations
// ============================================================

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { VenueService } from './venue.service.js';
import { CreateVenueDto, UpdateVenueDto, QueryVenueDto } from './dto/index.js';
import { ClerkAuthGuard } from '../auth/guards/clerk-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Public } from '../common/decorators/public.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { UserRole } from '@prisma/client';
import type { AuthUser } from '../auth/interfaces/auth-user.interface.js';

@Controller('venues')
@UseGuards(ClerkAuthGuard, RolesGuard)
export class VenueController {
  constructor(private readonly venueService: VenueService) {}

  @Post()
  @Roles(UserRole.OWNER)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateVenueDto, @CurrentUser() user: AuthUser) {
    return this.venueService.create(user.id, dto);
  }

  @Get()
  @Public()
  findAll(@Query() query: QueryVenueDto) {
    return this.venueService.findAll(query);
  }

  @Get('featured')
  @Public()
  findFeatured() {
    return this.venueService.findFeatured();
  }

  @Get('my')
  @Roles(UserRole.OWNER)
  findMine(@CurrentUser() user: AuthUser) {
    return this.venueService.findMine(user.id);
  }

  @Get(':id')
  @Public()
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.venueService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVenueDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.venueService.update(id, user.id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.venueService.remove(id, user);
  }

  // ── Ownership Routes ──────────────────────────────────────

  @Post(':id/ownership/request')
  @Roles(UserRole.OWNER)
  @HttpCode(HttpStatus.CREATED)
  requestOwnership(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.venueService.requestOwnership(id, user.id);
  }

  @Post(':id/ownership/approve')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  approveOwnership(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() admin: AuthUser,
  ) {
    return this.venueService.approveOwnership(id, admin.id);
  }

  @Post(':id/ownership/reject')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  rejectOwnership(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() admin: AuthUser,
  ) {
    return this.venueService.rejectOwnership(id, admin.id);
  }
}

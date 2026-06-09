// ============================================================
// DatSanVN — FieldController
// REST API for field (sân con) CRUD operations
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
import { FieldService } from './field.service.js';
import { CreateFieldDto, UpdateFieldDto } from './dto/index.js';
import { ClerkAuthGuard } from '../auth/guards/clerk-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { UserRole } from '@prisma/client';
import type { AuthUser } from '../auth/interfaces/auth-user.interface.js';

@Controller()
@UseGuards(ClerkAuthGuard, RolesGuard)
export class FieldController {
  constructor(private readonly fieldService: FieldService) {}

  @Post('venues/:venueId/fields')
  @Roles(UserRole.OWNER)
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('venueId', ParseUUIDPipe) venueId: string,
    @Body() dto: CreateFieldDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.fieldService.create(venueId, user.id, dto);
  }

  @Get('venues/:venueId/fields')
  @Public()
  findByVenue(@Param('venueId', ParseUUIDPipe) venueId: string) {
    return this.fieldService.findByVenue(venueId);
  }

  @Get('fields/:id')
  @Public()
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.fieldService.findOne(id);
  }

  @Get('fields/:id/slots')
  @Public()
  getSlots(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('date') date: string,
  ) {
    return this.fieldService.getAvailableSlots(id, date);
  }

  @Patch('fields/:id')
  @Roles(UserRole.OWNER)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFieldDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.fieldService.update(id, user.id, dto);
  }

  @Delete('fields/:id')
  @Roles(UserRole.OWNER)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.fieldService.remove(id, user.id);
  }
}

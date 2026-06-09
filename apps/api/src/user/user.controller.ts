import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  UseGuards,
  ForbiddenException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UserService } from './user.service.js';
import { UpdateUserDto } from './dto/index.js';
import { ClerkAuthGuard } from '../auth/guards/clerk-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { UserRole } from '@prisma/client';
import type { AuthUser } from '../auth/interfaces/auth-user.interface.js';

/**
 * UserController — REST API for user management.
 *
 * All routes require authentication via ClerkAuthGuard.
 * Role-based access is enforced via RolesGuard + @Roles().
 *
 * Routes:
 *   GET    /api/users        → list all users (ADMIN only)
 *   GET    /api/users/me     → get current user's profile
 *   GET    /api/users/:id    → get user by ID (ADMIN only)
 *   PATCH  /api/users/:id    → update user (self or ADMIN)
 *   DELETE /api/users/:id    → soft-delete user (ADMIN only)
 *
 * Note: Users are created via Clerk webhooks, not via this controller.
 */
@Controller('users')
@UseGuards(ClerkAuthGuard, RolesGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * GET /api/users — List all users with pagination.
   * ADMIN only.
   */
  @Get()
  @Roles(UserRole.ADMIN)
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.userService.findAll(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  /**
   * GET /api/users/me — Get current authenticated user's profile.
   *
   * This route MUST be defined before `:id` route to avoid
   * "me" being interpreted as a UUID parameter.
   */
  @Get('me')
  getMyProfile(@CurrentUser('id') userId: string) {
    return this.userService.getMyProfile(userId);
  }

  /**
   * GET /api/users/:id — Get a single user by ID.
   * ADMIN only.
   */
  @Get(':id')
  @Roles(UserRole.ADMIN)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.userService.findOne(id);
  }

  /**
   * PATCH /api/users/:id — Update a user's profile.
   *
   * Authorization:
   *  - Users can update their own profile
   *  - ADMIN can update any profile
   */
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    // Self-update OR admin
    if (currentUser.id !== id && currentUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You can only update your own profile');
    }

    return this.userService.update(id, dto);
  }

  /**
   * DELETE /api/users/:id — Soft-delete a user.
   * ADMIN only.
   */
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.userService.remove(id);
  }
}

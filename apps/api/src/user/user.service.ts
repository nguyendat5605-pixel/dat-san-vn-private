import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UserRole } from '@prisma/client';
import type { UpdateUserDto } from './dto/index.js';
import type { ClerkUserData } from '../webhooks/clerk/dto/index.js';
import { success } from '../common/helpers/api-response.helper.js';

/**
 * UserService — manages user CRUD and Clerk sync operations.
 *
 * Single source of truth for user data operations:
 *  - syncFromClerk()  → called by ClerkWebhookService (webhook handler)
 *  - findByClerkId()  → called by ClerkAuthGuard (JWT verification)
 *  - findAll/findOne  → called by UserController (admin endpoints)
 *  - update/remove    → called by UserController (user management)
 *
 * Design decisions:
 *  - syncFromClerk uses upsert → idempotent, safe for webhook replays
 *  - Role is never overwritten by Clerk sync → managed by admin flows
 *  - Soft-delete (isActive=false) instead of hard delete → keeps FK integrity
 */
@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Clerk Sync ─────────────────────────────────────────────────────────────

  /**
   * Sync user data from Clerk webhook into our database.
   *
   * Called by ClerkWebhookService on user.created and user.updated events.
   * Uses upsert for idempotency — safe to call multiple times with the same data.
   *
   * Fields synced: email, fullName, phone, avatarUrl
   * Fields preserved: role, isActive (managed by our domain)
   *
   * @param clerkUser  Clerk user data from webhook payload
   * @returns          Upserted user record
   */
  async syncFromClerk(clerkUser: ClerkUserData) {
    const email = this.extractPrimaryEmail(clerkUser);
    const phone = this.extractPrimaryPhone(clerkUser);
    const fullName = this.buildFullName(clerkUser);

    const user = await this.prisma.user.upsert({
      where: { clerkId: clerkUser.id },
      create: {
        clerkId: clerkUser.id,
        email: email ?? `clerk_${clerkUser.id}@placeholder.invalid`,
        fullName,
        phone: phone ?? undefined,
        avatarUrl: clerkUser.image_url ?? undefined,
        role: UserRole.PLAYER,
        isActive: true,
      },
      update: {
        // Sync profile data from Clerk
        ...(email && { email }),
        fullName,
        avatarUrl: clerkUser.image_url ?? undefined,
        ...(phone !== null && { phone }),
        // Ensure user is re-activated if they were soft-deleted and re-created
        isActive: true,
      },
    });

    this.logger.log(
      `[syncFromClerk] Upserted user id=${user.id} clerkId=${clerkUser.id}`,
    );

    return user;
  }

  /**
   * Handle Clerk user.deleted event — soft-delete the user.
   *
   * @param clerkId  Clerk user ID of the deleted user
   */
  async softDeleteByClerkId(clerkId: string): Promise<void> {
    const existingUser = await this.prisma.user.findUnique({
      where: { clerkId },
      select: { id: true, isActive: true },
    });

    if (!existingUser) {
      this.logger.warn(
        `[softDeleteByClerkId] User not found for clerkId=${clerkId}. No action taken.`,
      );
      return;
    }

    if (!existingUser.isActive) {
      this.logger.log(
        `[softDeleteByClerkId] User id=${existingUser.id} already inactive. Skipping.`,
      );
      return;
    }

    await this.prisma.user.update({
      where: { clerkId },
      data: { isActive: false },
    });

    this.logger.log(
      `[softDeleteByClerkId] Soft-deleted user id=${existingUser.id} clerkId=${clerkId}`,
    );
  }

  // ─── Query Methods ──────────────────────────────────────────────────────────

  /**
   * Find a user by their Clerk ID.
   * Used by ClerkAuthGuard for JWT → DB user lookup.
   */
  async findByClerkId(clerkId: string) {
    return this.prisma.user.findUnique({
      where: { clerkId },
      select: {
        id: true,
        clerkId: true,
        email: true,
        role: true,
        isActive: true,
      },
    });
  }

  /**
   * List all users with pagination (ADMIN only).
   */
  async findAll(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          clerkId: true,
          email: true,
          fullName: true,
          phone: true,
          avatarUrl: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.user.count(),
    ]);

    return success(
      {
        items: users,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      },
      'Users retrieved successfully',
    );
  }

  /**
   * Get a single user by DB ID.
   */
  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        clerkId: true,
        email: true,
        fullName: true,
        phone: true,
        avatarUrl: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    return success(user, 'User retrieved successfully');
  }

  /**
   * Get the current authenticated user's full profile.
   */
  async getMyProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        clerkId: true,
        email: true,
        fullName: true,
        phone: true,
        avatarUrl: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            bookings: true,
            reviews: true,
            ownerships: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    return success(user, 'Profile retrieved successfully');
  }

  // ─── Mutation Methods ───────────────────────────────────────────────────────

  /**
   * Update a user's profile.
   *
   * Authorization rules (enforced by controller):
   *  - Users can update their own profile
   *  - ADMIN can update any profile
   */
  async update(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...dto,
      },
      select: {
        id: true,
        clerkId: true,
        email: true,
        fullName: true,
        phone: true,
        avatarUrl: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    this.logger.log(`[update] User updated: ${id}`);
    return success(updated, 'User updated successfully');
  }

  /**
   * Soft-delete a user by DB ID (ADMIN only).
   */
  async remove(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });

    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    if (!user.isActive) {
      return success(null, 'User already deactivated');
    }

    await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    this.logger.log(`[remove] User soft-deleted: ${id}`);
    return success(null, 'User deactivated successfully');
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  /**
   * Extracts the primary email string from ClerkUserData.
   */
  private extractPrimaryEmail(data: ClerkUserData): string | null {
    if (!data.primary_email_address_id) return null;

    const emailObj = data.email_addresses.find(
      (e) => e.id === data.primary_email_address_id,
    );

    return emailObj?.email_address ?? null;
  }

  /**
   * Extracts the primary phone number string from ClerkUserData.
   */
  private extractPrimaryPhone(data: ClerkUserData): string | null {
    if (!data.primary_phone_number_id) return null;

    const phoneObj = data.phone_numbers.find(
      (p) => p.id === data.primary_phone_number_id,
    );

    return phoneObj?.phone_number ?? null;
  }

  /**
   * Builds a display name from Clerk first_name + last_name.
   */
  private buildFullName(data: ClerkUserData): string {
    const parts = [data.first_name, data.last_name].filter(
      (p): p is string => typeof p === 'string' && p.trim().length > 0,
    );
    return parts.length > 0 ? parts.join(' ') : 'Unknown';
  }
}

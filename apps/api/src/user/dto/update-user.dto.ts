import { PartialType, PickType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto.js';

/**
 * UpdateUserDto — fields a user (or admin) can update via PATCH /api/users/:id.
 *
 * Only exposes safe, updatable fields from CreateUserDto:
 *  - fullName
 *  - phone
 *  - avatarUrl
 *
 * All fields are optional (PartialType wraps them in `?`).
 *
 * Fields NOT updatable via this DTO:
 *  - email      → managed by Clerk, synced via webhook
 *  - clerkId    → immutable, set on creation
 *  - role       → changed only by admin via dedicated endpoint
 *  - isActive   → changed via soft-delete or admin action
 */
export class UpdateUserDto extends PartialType(
  PickType(CreateUserDto, ['fullName', 'phone', 'avatarUrl'] as const),
) {}

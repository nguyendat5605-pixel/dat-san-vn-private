import { Module } from '@nestjs/common';
import { UserController } from './user.controller.js';
import { UserService } from './user.service.js';
import { AuthModule } from '../auth/auth.module.js';

/**
 * UserModule — provides user management functionality.
 *
 * Dependencies:
 *  - AuthModule   → ClerkAuthGuard for JWT verification
 *  - PrismaModule → PrismaService (@Global, no import needed)
 *
 * Exports:
 *  - UserService  → used by WebhooksModule for Clerk user sync
 */
@Module({
  imports: [AuthModule],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}

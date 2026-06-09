import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createClerkClient } from '@clerk/backend';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ClerkAuthGuard } from './guards/clerk-auth.guard.js';

export const CLERK_CLIENT = 'CLERK_CLIENT';

@Global()
@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [
    {
      provide: CLERK_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return createClerkClient({
          secretKey: configService.getOrThrow<string>('CLERK_SECRET_KEY'),
          publishableKey: configService.get<string>('CLERK_PUBLISHABLE_KEY'),
        });
      },
    },
    ClerkAuthGuard,
  ],
  exports: [CLERK_CLIENT, ClerkAuthGuard],
})
export class AuthModule {}

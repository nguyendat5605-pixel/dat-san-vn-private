import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { WebhooksModule } from './webhooks/webhooks.module.js';
import { VenueModule } from './venue/venue.module.js';
import { FieldModule } from './field/field.module.js';
import { BookingModule } from './booking/booking.module.js';
import { UserModule } from './user/user.module.js';
import { clerkConfig } from './config/clerk.config.js';
import { QueuesModule } from './queues/queues.module.js';
import { AdminModule } from './admin/admin.module.js';
import { ReviewModule } from './review/review.module';
import { StaffModule } from './staff/staff.module.js';
import { UploadModule } from './upload/upload.module.js';
import { PaymentModule } from './payment/payment.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';

const uploadStorageDriver =
  process.env.UPLOAD_STORAGE_DRIVER ??
  (process.env.NODE_ENV === 'production' ? 'supabase' : 'local');
const localUploadStaticModules =
  process.env.NODE_ENV !== 'production' && uploadStorageDriver === 'local'
    ? [
        ServeStaticModule.forRoot({
          rootPath: join(process.cwd(), 'uploads'),
          serveRoot: '/uploads',
          serveStaticOptions: {
            index: false,
            setHeaders: (res) => {
              res.setHeader('X-Content-Type-Options', 'nosniff');
              res.setHeader(
                'Content-Security-Policy',
                "default-src 'none'; script-src 'none'",
              );
            },
          },
        }),
      ]
    : [];

/**
 * AppModule — root module.
 *
 * Global singletons (available in all child modules without re-importing):
 *  - ConfigModule   → env vars + typed config namespaces via ConfigService
 *  - PrismaModule   → @Global(), PrismaService injectable everywhere
 *
 * Feature modules:
 *  - AuthModule     → ClerkAuthGuard for JWT verification
 *  - UserModule     → User CRUD at /api/users
 *  - WebhooksModule → Clerk webhook at POST /webhooks/clerk
 *  - VenueModule    → Venue CRUD at /api/venues
 *  - FieldModule    → Field CRUD at /api/venues/:id/fields + /api/fields/:id
 *  - BookingModule  → Booking logic at /api/bookings
 *  - AdminModule    → Admin management at /api/admin (ADMIN role only)
 */
@Module({
  imports: [
    /**
     * ConfigModule.forRoot() — loads env vars globally.
     *
     * load: [clerkConfig] registers the 'clerk' namespace so you can use:
     *   configService.get<string>('clerk.webhookSecret')
     * AND the flat key still works:
     *   configService.get<string>('CLERK_WEBHOOK_SECRET')
     *
     * The `clerkConfig` factory validates CLERK_WEBHOOK_SECRET,
     * CLERK_SECRET_KEY, and CLERK_PUBLISHABLE_KEY at startup —
     * if any are missing, the app will fail to boot with a clear error message.
     */
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [clerkConfig],
    }),

    // Serve local upload files only for explicit development local storage.
    ...localUploadStaticModules,

    // Global Prisma client — PrismaService injectable in any module
    PrismaModule,

    // Authentication
    AuthModule,

    // Socket.IO realtime updates
    RealtimeModule,

    // User management
    UserModule,

    // Webhook handlers
    WebhooksModule,

    // Core business modules
    VenueModule,
    FieldModule,
    BookingModule,

    // Background Jobs
    QueuesModule,

    // Admin management
    AdminModule,

    ReviewModule,

    // Staff management (venue-scoped permissions)
    StaffModule,

    // Image upload
    UploadModule,

    // Payment initiation skeleton
    PaymentModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

# Project Report Evidence Audit

| Report claim | Status | Evidence path | Notes |
| ------------ | ------ | ------------- | ----- |
| Monorepo/Turborepo/pnpm | Verified | `package.json`; `pnpm-workspace.yaml`; `turbo.json` | Root package uses `pnpm@9.0.0`, Turbo scripts, and workspaces `apps/*`, `packages/*`. |
| Next.js frontend | Verified | `apps/web/package.json`; `apps/web/app` | `next 16.2.0`, App Router pages present. |
| NestJS backend | Verified | `apps/api/package.json`; `apps/api/src/app.module.ts` | NestJS 11.x modules/controllers are registered. |
| Prisma/PostgreSQL | Verified | `apps/api/prisma/schema.prisma`; `apps/api/prisma.config.ts`; `apps/api/src/prisma/prisma.service.ts` | Datasource provider is PostgreSQL; Prisma CLI/client 7.7.0. |
| Redis/BullMQ | Verified | `apps/api/package.json`; `apps/api/src/config/bullmq.config.ts`; `apps/api/src/config/redis.config.ts`; `apps/api/src/queues/booking-expiration/*` | BullMQ/ioredis installed and used for booking expiration. |
| Clerk auth | Verified | `apps/web/package.json`; `apps/web/app/layout.tsx`; `apps/api/src/auth/guards/clerk-auth.guard.ts`; `apps/api/src/webhooks/clerk/*` | Clerk frontend/backend packages, JWT guard, and webhook sync exist. |
| Role-based access | Verified | `apps/api/prisma/schema.prisma`; `apps/api/src/common/guards/roles.guard.ts`; `apps/api/src/common/guards/staff.guard.ts`; controllers under `apps/api/src` | Roles are `PLAYER`, `OWNER`, `ADMIN`; staff permissions are venue-scoped. |
| Venue CRUD | Verified | `apps/api/src/venue/venue.controller.ts`; `apps/api/src/venue/venue.service.ts`; `apps/web/app/(main)/owner/venues/page.tsx` | Public list/detail, owner create/update/delete, ownership/admin approval flows exist. |
| Field CRUD | Verified | `apps/api/src/field/field.controller.ts`; `apps/api/src/field/field.service.ts`; `apps/web/app/(main)/owner/venues/[id]/fields/page.tsx` | Owner create/update/delete and public field/slot reads exist. |
| Slot availability | Verified | `apps/api/prisma/schema.prisma`; `apps/api/src/field/field.service.ts`; `apps/api/src/booking/booking.service.ts` | `VenueSlot.status` uses `AVAILABLE`, `LOCKED`, `BOOKED`; booking checks `AVAILABLE`. |
| Booking creation | Verified | `apps/api/src/booking/booking.controller.ts`; `apps/api/src/booking/booking.service.ts`; `apps/web/components/booking/booking-sheet.tsx` | `POST /api/bookings` creates booking and locks slot in a transaction. |
| Conflict prevention / optimistic locking | Verified | `apps/api/src/common/optimistic-lock.guard.ts`; `apps/api/src/booking/booking.service.ts`; `apps/api/prisma/migrations/20260429090000_add_optimistic_locking/migration.sql` | Uses `updateMany` guards, status checks, and `version` increments. |
| Booking timeout rollback | Verified | `apps/api/src/queues/booking-expiration/booking-expiration.service.ts`; `apps/api/src/queues/booking-expiration/booking-expiration.processor.ts`; `apps/api/src/booking/booking.service.ts` | Default is 5 minutes via `PAYMENT_HOLD_MINUTES` fallback; processor cancels PENDING and releases LOCKED slots. |
| Payment foundation | Verified | `apps/api/prisma/schema.prisma`; `apps/api/prisma/migrations/20260527090000_add_payment_foundation/migration.sql`; `apps/api/src/payment/payment.service.ts` | Payment aggregate, attempts, webhook events, statuses, indexes and service flow exist. |
| Payment provider integration | Partially verified | `apps/api/src/payment/providers/momo-payment.provider.ts`; `apps/api/src/payment/providers/vnpay-payment.provider.ts`; `apps/api/src/payment/payment.controller.ts`; `apps/api/src/payment/payment.service.ts` | MoMo sandbox has API call + signature/webhook + status transition. VNPay webhook verification is not implemented. Not production-complete. |
| Review system | Verified | `apps/api/src/review/review.controller.ts`; `apps/api/src/review/review.service.ts`; `apps/web/components/review/*` | API and frontend section exist; frontend includes mock fallback reviews if API returns empty. |
| Admin dashboard | Verified | `apps/api/src/admin/admin.controller.ts`; `apps/api/src/admin/admin.service.ts`; `apps/web/app/(main)/admin/*`; `apps/web/components/admin/*` | Admin stats/users/venues/bookings UI and API exist. |
| Owner dashboard | Partially verified | `apps/web/app/(main)/owner/*`; `apps/web/components/owner/*`; `apps/api/src/booking/booking.controller.ts`; `apps/api/src/venue/venue.controller.ts` | Real API pages exist, but dashboard/bookings have mock fallback components. |
| Mobile app | Not found | Repository search for React Native/Expo/Flutter/native markers | No native app found; only responsive web/mobile UI direction. |
| Real-time dashboard | Not found | Repository search for WebSocket/Socket.io/gateway modules | No WebSocket or realtime push implementation found. |
| Docker Compose local services | Verified | `docker-compose.yml` | Defines PostgreSQL 16 and Redis 7 services. |
| Seed scripts | Verified | `apps/api/package.json`; `apps/api/scripts/seed-demo-data.ts`; `apps/api/scripts/seed-clerk-users.ts` | Scripts exist; this audit did not execute DB-changing seed commands. |
| Test scripts | Partially verified | `apps/api/package.json`; `apps/web/package.json` | API has Jest scripts; web has `check-types`; this audit did not run tests/builds. |

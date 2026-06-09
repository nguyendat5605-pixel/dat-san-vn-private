# Báo cáo kỹ thuật dự án DatSanVN — Kiểm toán mã nguồn

> **Ngày kiểm toán**: 30/05/2026  
> **Phạm vi**: Toàn bộ repository `dat-san-vn` — mã nguồn frontend, backend, database schema, cấu hình monorepo.  
> **Phương pháp**: Phân tích tĩnh mã nguồn, đọc cấu trúc thư mục, file cấu hình, Prisma schema, và logic xử lý nghiệp vụ.  
> **Lưu ý**: Báo cáo chỉ ghi nhận những gì thực sự tồn tại trong mã nguồn. Không suy đoán.

---

## 1. Technology Stack (phát hiện thực tế từ mã nguồn)

### 1.1 Tổng quan stack

| Tầng | Công nghệ | Phiên bản (từ `package.json`) | File xác minh |
|---|---|---|---|
| **Monorepo** | Turborepo + pnpm workspaces | turbo `^2.9.5`, pnpm `9.0.0` | `turbo.json`, `pnpm-workspace.yaml` |
| **Frontend** | Next.js (App Router) + React | next `16.2.0`, react `^19.2.0` | `apps/web/package.json` |
| **UI Library** | shadcn/ui (New York style) + Radix UI | Nhiều gói `@radix-ui/*` | `apps/web/components.json`, `apps/web/components/ui/` |
| **CSS** | Tailwind CSS v4 | `^4.2.2` | `apps/web/package.json` |
| **Backend** | NestJS | `^11.0.1` | `apps/api/package.json` |
| **HTTP Platform** | Express (qua `@nestjs/platform-express`) | `^11.0.1` | `apps/api/package.json` |
| **ORM** | Prisma v7 (PostgreSQL adapter) | prisma `^7.7.0`, `@prisma/client ^7.7.0` | `apps/api/package.json`, `apps/api/prisma/schema.prisma` |
| **Database** | PostgreSQL 16 | postgres `16-alpine` (Docker) | `docker-compose.yml`, Prisma schema `provider = "postgresql"` |
| **Queue** | BullMQ | `^5.73.5` | `apps/api/package.json` |
| **Cache / Lock** | Redis (ioredis) | ioredis `^5.10.1`, Redis `7-alpine` (Docker) | `apps/api/package.json`, `apps/api/src/config/redis.config.ts` |
| **Auth** | Clerk | `@clerk/backend ^3.2.8`, `@clerk/nextjs ^7.2.3` | Cả 2 `package.json` |
| **Webhook verify** | Svix | `^1.90.0` | `apps/api/package.json` |
| **File Upload** | Multer + Supabase Storage | multer `^2.1.1`, `@supabase/supabase-js ^2.106.2` | `apps/api/package.json`, `apps/api/src/upload/` |
| **Validation** | class-validator + class-transformer | `^0.15.1`, `^0.5.1` | `apps/api/package.json` |
| **Form** | react-hook-form | `^7.72.1` | `apps/web/package.json` |
| **Date** | date-fns | `^4.1.0` | `apps/web/package.json` |
| **Icons** | Lucide React + Radix Icons | `^1.8.0`, `^1.3.2` | `apps/web/package.json` |
| **Language** | TypeScript | `5.9.2` (root), `^5.7.3` (API) | `package.json` |
| **Runtime** | Node.js ≥ 18 | `.mise.toml` chỉ định `22.14.0` | `package.json` engines |

### 1.2 Công nghệ KHÔNG có trong mã nguồn

| Công nghệ | Trạng thái | Ghi chú |
|---|---|---|
| **Flutter** | ❌ Không tồn tại | Không có file `.dart`, `pubspec.yaml`, hoặc thư mục Flutter |
| **React Native** | ❌ Không tồn tại | Không có dependency `react-native` trong bất kỳ `package.json` nào |
| **Express (standalone)** | ❌ Không sử dụng | Express chỉ là HTTP adapter bên trong NestJS (`@nestjs/platform-express`), không phải framework chính |
| **MySQL** | ❌ Không sử dụng | Prisma schema khai báo `provider = "postgresql"` |
| **MongoDB** | ❌ Không tồn tại | Không có driver MongoDB |
| **Mobile App** | ❌ Không tồn tại | Chỉ có web application |

### 1.3 Cloud Services (từ `.env.example`)

| Dịch vụ | Mục đích | Ghi chú |
|---|---|---|
| **Supabase** | PostgreSQL cloud + Storage | `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` |
| **Upstash** | Redis cloud | `REDIS_URL`, `REDIS_HOST`, `REDIS_PASSWORD`, `REDIS_TLS` |
| **Clerk** | Authentication (JWT + Webhooks) | `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` |
| **MoMo Sandbox** | Payment gateway | `MOMO_SANDBOX_ENDPOINT`, `MOMO_PARTNER_CODE`, `MOMO_SECRET_KEY` |
| **VNPAY Sandbox** | Payment gateway (placeholder) | `VNPAY_SANDBOX_ENDPOINT` — chưa implement đầy đủ |
| **Railway** | Deployment (API) | `nixpacks.toml` config |

---

## 2. Cấu trúc dự án (project structure tree)

```
dat-san-vn/
├── apps/
│   ├── api/                              # NestJS backend
│   │   ├── prisma/
│   │   │   └── schema.prisma             # Prisma schema (399 dòng, 12 model, 11 enum)
│   │   ├── scripts/                      # Scripts tiện ích (seed, clear, audit)
│   │   └── src/
│   │       ├── main.ts                   # Entry point
│   │       ├── app.module.ts             # Root module
│   │       ├── app.controller.ts         # Health check
│   │       ├── app.service.ts            # App-level service
│   │       ├── admin/                    # Admin CRUD (venues, users, bookings)
│   │       ├── auth/                     # ClerkAuthGuard, interfaces
│   │       ├── booking/                  # Booking CRUD + idempotency
│   │       ├── common/                   # Guards, decorators, helpers, filters, interceptors
│   │       ├── config/                   # BullMQ, Clerk, Redis config
│   │       ├── field/                    # Field CRUD
│   │       ├── payment/                  # Payment module + MoMo/VNPAY providers
│   │       ├── prisma/                   # PrismaService
│   │       ├── queues/                   # BullMQ booking-expiration processor
│   │       ├── review/                   # Review CRUD + eligibility
│   │       ├── staff/                    # VenueStaff CRUD
│   │       ├── upload/                   # File upload (Supabase Storage)
│   │       ├── user/                     # User CRUD + role management
│   │       ├── venue/                    # Venue CRUD + ownership + approval
│   │       └── webhooks/                 # Clerk webhook handler
│   │
│   └── web/                              # Next.js 16 frontend
│       ├── app/
│       │   ├── (auth)/                   # Clerk sign-in / sign-up pages
│       │   ├── (main)/
│       │   │   ├── page.tsx              # Trang chủ
│       │   │   ├── search/page.tsx       # Tìm kiếm sân
│       │   │   ├── venues/[id]/page.tsx  # Chi tiết sân + booking
│       │   │   ├── bookings/page.tsx     # Lịch sử booking (player)
│       │   │   ├── payments/return/      # Trang trả về sau thanh toán
│       │   │   ├── owner/               # Owner dashboard
│       │   │   │   ├── page.tsx          # Dashboard tổng quan
│       │   │   │   ├── venues/           # Quản lý sân (CRUD)
│       │   │   │   └── bookings/         # Quản lý booking
│       │   │   └── admin/               # Admin panel
│       │   │       ├── page.tsx          # Dashboard admin
│       │   │       ├── venues/           # Duyệt sân
│       │   │       ├── users/            # Quản lý user
│       │   │       └── bookings/         # Xem booking toàn hệ thống
│       │   └── dashboard/               # Dashboard redirect
│       ├── components/
│       │   ├── admin/                    # Admin components (tables, stats)
│       │   ├── booking/                  # Booking components (sheet, badge, list)
│       │   ├── common/                   # Common components (empty-state, image-uploader)
│       │   ├── layout/                   # Navbar, Footer
│       │   ├── owner/                    # Owner components (forms, tables, clients)
│       │   ├── review/                   # Review components (form, list, section)
│       │   ├── ui/                       # shadcn/ui primitives (15 components)
│       │   └── venue/                    # Venue components (card, list, filters, gallery, map)
│       ├── hooks/                        # use-toast.ts
│       └── lib/                          # API clients, utils, mock data
│
├── packages/
│   ├── types/                            # Shared TypeScript types/interfaces
│   │   └── src/index.ts                  # Enums + interfaces (163 dòng)
│   ├── typescript-config/                # Shared TS configs (không được sử dụng)
│   └── utils/                            # TRỐNG — chưa có code
│
├── docker-compose.yml                    # PostgreSQL 16 + Redis 7 (local dev)
├── nixpacks.toml                         # Railway deployment config
├── turbo.json                            # Turborepo task config
├── pnpm-workspace.yaml                   # pnpm workspaces: apps/* + packages/*
└── package.json                          # Root scripts + devDependencies
```

---

## 3. Frontend Modules / Pages

### 3.1 Routes (App Router)

| Route | File | Mô tả | Auth |
|---|---|---|---|
| `/` | `app/(main)/page.tsx` | Trang chủ — hero section, danh sách sân nổi bật | Public |
| `/search` | `app/(main)/search/page.tsx` | Tìm kiếm sân theo bộ lọc | Public |
| `/venues/[id]` | `app/(main)/venues/[id]/page.tsx` | Chi tiết sân, danh sách field, slot khả dụng, booking sheet, review | Public (booking cần login) |
| `/bookings` | `app/(main)/bookings/page.tsx` | Lịch sử booking của player | PLAYER |
| `/payments/return` | `app/(main)/payments/return/page.tsx` | Callback sau khi thanh toán MoMo | PLAYER |
| `/sign-in` | `app/(auth)/sign-in/` | Đăng nhập qua Clerk | Public |
| `/sign-up` | `app/(auth)/sign-up/` | Đăng ký qua Clerk | Public |
| `/owner` | `app/(main)/owner/page.tsx` | Owner dashboard — tổng quan | OWNER |
| `/owner/venues` | `app/(main)/owner/venues/page.tsx` | Quản lý danh sách sân | OWNER |
| `/owner/venues/[id]` | `app/(main)/owner/venues/[id]/` | Chi tiết sân + quản lý field | OWNER |
| `/owner/bookings` | `app/(main)/owner/bookings/page.tsx` | Quản lý booking | OWNER |
| `/admin` | `app/(main)/admin/page.tsx` | Admin dashboard — tổng quan | ADMIN |
| `/admin/venues` | `app/(main)/admin/venues/page.tsx` | Duyệt/từ chối venue | ADMIN |
| `/admin/users` | `app/(main)/admin/users/page.tsx` | Quản lý user + đổi role | ADMIN |
| `/admin/bookings` | `app/(main)/admin/bookings/page.tsx` | Xem booking toàn hệ thống | ADMIN |

### 3.2 Frontend Components

| Thư mục | Component | File | Mô tả |
|---|---|---|---|
| **booking/** | `BookingSheet` | `booking-sheet.tsx` | Side-sheet đặt sân: chọn slot, xác nhận, tạo booking + thanh toán MoMo |
| | `BookingStatusBadge` | `booking-status-badge.tsx` | Badge hiển thị trạng thái booking |
| | `BookingsList` | `bookings-list.tsx` | Danh sách booking dạng list |
| | `PlayerBookingsClient` | `player-bookings-client.tsx` | Client component quản lý booking của player |
| **venue/** | `VenueCard` | `venue-card.tsx` | Card hiển thị thông tin venue |
| | `VenueList` | `venue-list.tsx` | Grid danh sách venues |
| | `SearchFilters` | `search-filters.tsx` | Bộ lọc tìm kiếm (quận, loại sân, giá) |
| | `VenueGallery` | `venue-gallery.tsx` | Gallery ảnh sân |
| | `VenueMap` | `venue-map.tsx` | Hiển thị bản đồ vị trí sân |
| **owner/** | `OwnerVenuesClient` | `owner-venues-client.tsx` | CRUD venue cho owner (10KB) |
| | `OwnerFieldsClient` | `owner-fields-client.tsx` | CRUD field cho owner (8.8KB) |
| | `OwnerBookingsClient` | `owner-bookings-client.tsx` | Quản lý booking của owner |
| | `VenueForm` | `venue-form.tsx` | Form tạo/sửa venue |
| | `FieldForm` | `field-form.tsx` | Form tạo/sửa field |
| | `BookingTable` | `booking-table.tsx` | Bảng booking cho owner |
| | `BookingFilterTabs` | `booking-filter-tabs.tsx` | Tabs lọc booking theo status |
| | `StatsCard` | `stats-card.tsx` | Card thống kê |
| **admin/** | `VenueApprovalTable` | `venue-approval-table.tsx` | Bảng duyệt venue (9KB) |
| | `UsersTable` | `users-table.tsx` | Bảng quản lý user (7.5KB) |
| | `AdminBookingsTable` | `admin-bookings-table.tsx` | Bảng booking toàn hệ thống |
| | `StatsOverview` | `stats-overview.tsx` | Tổng quan thống kê admin |
| **review/** | `VenueReviewsSection` | `venue-reviews-section.tsx` | Section review trong trang venue detail |
| | `ReviewForm` | `review-form.tsx` | Form viết review |
| | `ReviewList` | `review-list.tsx` | Danh sách reviews |
| **layout/** | `Navbar` | `navbar.tsx` | Navigation bar |
| | `Footer` | `footer.tsx` | Footer |
| **common/** | `ImageUploader` | `image-uploader.tsx` | Upload ảnh (8.1KB) |
| | `EmptyState` | `empty-state.tsx` | Trạng thái trống |
| | `SectionHeading` | `section-heading.tsx` | Heading cho section |
| **ui/** | 15 shadcn/ui components | `avatar, badge, button, card, dialog, dropdown-menu, input, label, sheet, skeleton, table, tabs, textarea, toast, toaster` | Radix UI primitives |

### 3.3 Lib / API Clients

| File | Mô tả |
|---|---|
| `lib/api.ts` | API client chung — `getVenues`, `getVenueDetail`, `getFieldAvailableSlots` |
| `lib/player-booking-api.ts` | API booking cho player — `createPlayerBooking`, `getMyBookings`, `cancelBooking` |
| `lib/player-payment-api.ts` | API payment cho player — `createPayment`, `getPaymentStatus` |
| `lib/owner-api.ts` | API cho owner — CRUD venue/field, managed bookings, confirm/cancel |
| `lib/admin-api.ts` | API cho admin — stats, venues approval, users, bookings |
| `lib/utils.ts` | Utility functions — `formatCurrency`, `formatTimeRange`, `cn()`, etc. |
| `lib/mock-data.ts` | Mock data cho demo (16KB) |
| `lib/mock-owner-bookings.ts` | Mock booking data cho owner demo (9.7KB) |

---

## 4. Backend Modules / Services / Controllers

### 4.1 Danh sách NestJS Modules

| Module | File chính | Controller | Service | Mô tả |
|---|---|---|---|---|
| **AppModule** | `app.module.ts` | `AppController` | `AppService` | Root module, health check |
| **AuthModule** | `auth/auth.module.ts` | — | — | Cung cấp `ClerkAuthGuard` |
| **UserModule** | `user/user.module.ts` | `UserController` | `UserService` | CRUD user, đổi role, lấy thông tin `/me` |
| **VenueModule** | `venue/venue.module.ts` | `VenueController` | `VenueService` | CRUD venue, ownership, approval, listing |
| **FieldModule** | `field/field.module.ts` | `FieldController` | `FieldService` | CRUD field trong venue |
| **BookingModule** | `booking/booking.module.ts` | `BookingController` | `BookingService`, `BookingIdempotencyService` | Tạo/confirm/cancel booking, idempotency |
| **PaymentModule** | `payment/payment.module.ts` | `PaymentController` | `PaymentService`, `PaymentInitiationIdempotencyService`, `PaymentConfig`, providers | Tạo payment, MoMo webhook |
| **ReviewModule** | `review/review.module.ts` | `ReviewController` | `ReviewService` | CRUD review, eligibility check |
| **StaffModule** | `staff/staff.module.ts` | `StaffController` | `StaffService` | CRUD venue staff |
| **AdminModule** | `admin/admin.module.ts` | `AdminController` | `AdminService` | Admin operations |
| **QueuesModule** | `queues/queues.module.ts` | — | `BookingExpirationService`, `BookingExpirationProcessor` | BullMQ auto-cancel booking |
| **UploadModule** | `upload/upload.module.ts` | `UploadController` | `UploadStorageService` | File upload (Supabase Storage) |
| **WebhooksModule** | `webhooks/webhooks.module.ts` | Clerk webhook handler | — | Clerk user sync |
| **PrismaModule** | `prisma/` | — | `PrismaService` | Database access |

### 4.2 Payment Providers

| Provider | File | Trạng thái |
|---|---|---|
| **MoMo** | `payment/providers/momo-payment.provider.ts` (474 dòng) | ✅ Đầy đủ — tạo payment, verify webhook, HMAC-SHA256 signature |
| **VNPAY** | `payment/providers/vnpay-payment.provider.ts` (70 dòng) | ⚠️ Stub — chỉ tạo sandbox URL giả, webhook `NotImplementedException` |
| **Mock** | `payment/providers/mock-payment.provider.ts` | ✅ Provider mock cho testing |
| **Registry** | `payment/providers/payment-provider.registry.ts` | ✅ Registry pattern cho providers |

### 4.3 Guards & Decorators

| File | Mô tả |
|---|---|
| `auth/guards/clerk-auth.guard.ts` | Verify Clerk JWT từ header |
| `common/guards/roles.guard.ts` | Role-based access control (`@Roles()`) |
| `common/guards/staff.guard.ts` | Staff permission check (`@RequireStaffPermissions()`) |
| `common/decorators/current-user.decorator.ts` | `@CurrentUser()` param decorator |
| `common/decorators/roles.decorator.ts` | `@Roles()` metadata decorator |
| `common/decorators/staff-permissions.decorator.ts` | `@RequireStaffPermissions()` decorator |
| `common/decorators/public.decorator.ts` | `@Public()` decorator (skip auth) |
| `common/decorators/raw-body.decorator.ts` | `@RawBody()` cho webhook verification |
| `common/optimistic-lock.guard.ts` | `withOptimisticLock()` + `assertOptimisticUpdate()` |

---

## 5. Database Models (Prisma Schema)

### 5.1 Sơ đồ quan hệ

```
┌─────────┐     ┌────────────┐     ┌─────────┐
│  User   │────▶│ VenueOwner │◀────│  Venue  │
│         │     │(PENDING/   │     │         │
│(PLAYER, │     │ APPROVED/  │     │(isActive)│
│ OWNER,  │     │ REJECTED)  │     │(version) │
│ ADMIN)  │     └────────────┘     └────┬────┘
│         │                             │
│         │     ┌────────────┐     ┌────▼────┐
│         │────▶│  Booking   │     │  Field  │
│         │     │(PENDING→   │     │(sportType│
│         │     │ CONFIRMED→ │     │ size)    │
│         │     │ COMPLETED/ │     └────┬────┘
│         │     │ CANCELLED) │          │
│         │     │(version)   │     ┌────▼─────┐
│         │     └──────┬─────┘     │VenueSlot │
│         │            │           │(date,     │
│         │     ┌──────▼─────┐     │ startTime,│
│         │     │BookingSlot │◀───▶│ endTime,  │
│         │     │(M:N join)  │     │ price,    │
│         │     └────────────┘     │ status:   │
│         │                        │ AVAILABLE/│
│         │     ┌────────────┐     │ LOCKED/   │
│         │────▶│  Payment   │     │ BOOKED)   │
│         │     │(PENDING/   │     │(version)  │
│         │     │ PAID/      │     └───────────┘
│         │     │ REFUNDED)  │
│         │     └──────┬─────┘
│         │            │
│         │     ┌──────▼──────────┐
│         │     │PaymentAttempt   │
│         │     │(MoMo/VNPAY,    │
│         │     │ providerOrderId,│
│         │     │ paymentUrl)     │
│         │     └──────┬──────────┘
│         │            │
│         │     ┌──────▼──────────────┐
│         │     │PaymentWebhookEvent  │
│         │     │(signature verify,   │
│         │     │ processing status)  │
│         │     └─────────────────────┘
│         │
│         │     ┌────────────┐
│         │────▶│  Review    │
│         │     │(rating 1-5,│
│         │     │ comment)   │
│         │     └────────────┘
│         │
│         │     ┌────────────┐
│         │────▶│VenueStaff  │
│         │     │(permissions│
│         │     │ MANAGE_    │
│         │     │ BOOKINGS,  │
│         │     │ CREATE_    │
│         │     │ WALK_IN,..)│
│         │     └────────────┘
└─────────┘
```

### 5.2 Chi tiết các model

| Model | Bảng DB | Số field | Quan hệ chính | Ghi chú |
|---|---|---|---|---|
| **User** | `users` | 10 | → bookings, payments, reviews, ownerships, staffAt | Clerk sync via `clerkId` |
| **Venue** | `venues` | 16 | → fields, bookings, reviews, owners, staff | `version` cho optimistic locking, `deletedAt` cho soft delete |
| **Field** | `fields` | 8 | → venue, slots | `sportType` enum, `size` enum |
| **VenueSlot** | `venue_slots` | 9 | → field, bookingSlots | `date` + `startTime` + `endTime`, `status`: AVAILABLE/LOCKED/BOOKED |
| **Booking** | `bookings` | 12 | → user, venue, bookingSlots, payment, reviews | `expiresAt` cho auto-cancel |
| **BookingSlot** | `booking_slots` | 3 | → booking, venueSlot | Join table M:N giữa Booking và VenueSlot |
| **Payment** | `payments` | 16 | → booking, user, attempts | 1:1 với Booking, `method` enum, `status` enum |
| **PaymentAttempt** | `payment_attempts` | 16 | → payment, webhookEvents | Mỗi lần thử thanh toán = 1 attempt |
| **PaymentWebhookEvent** | `payment_webhook_events` | 12 | → attempt | Lưu trữ webhook từ gateway, có dedup bằng `payloadHash` |
| **VenueOwner** | `venue_owners` | 5 | → user, venue | `status`: PENDING/APPROVED/REJECTED |
| **Review** | `reviews` | 7 | → user, venue, booking | Rating 1-5, cần booking COMPLETED |
| **VenueStaff** | `venue_staff` | 7 | → venue, user, inviter | Permissions array enum |

### 5.3 Enums trong schema

| Enum | Giá trị |
|---|---|
| `UserRole` | PLAYER, OWNER, ADMIN |
| `VenueOwnerStatus` | PENDING, APPROVED, REJECTED |
| `SportType` | FOOTBALL, BADMINTON, TENNIS, BASKETBALL, VOLLEYBALL, TABLE_TENNIS, PICKLEBALL |
| `FieldSize` | FIELD_5, FIELD_7, FIELD_11, OTHER |
| `SlotStatus` | AVAILABLE, LOCKED, BOOKED |
| `BookingStatus` | PENDING, CONFIRMED, COMPLETED, CANCELLED |
| `PaymentStatus` | PENDING, PAID, REFUNDED_FULL, REFUNDED_HALF, FAILED |
| `PaymentMethod` | MOMO, VNPAY, BANK_TRANSFER, CASH |
| `PaymentProvider` | MOMO, VNPAY |
| `PaymentAttemptStatus` | PENDING, PROCESSING, PAID, FAILED, EXPIRED, CANCELLED, REQUIRES_RECONCILIATION |
| `PaymentWebhookProcessingStatus` | RECEIVED, PROCESSED, DUPLICATE, IGNORED, INVALID_SIGNATURE, AMOUNT_MISMATCH, FAILED |
| `StaffPermission` | MANAGE_BOOKINGS, CREATE_WALK_IN, PROCESS_PAYMENT, VIEW_SHIFT_REVENUE |

---

## 6. Booking Flow (dựa trên mã nguồn thực tế)

### 6.1 Luồng đặt sân (Player → MoMo)

```
┌──────────────────────────────────────────────────────────────────────┐
│                        BOOKING FLOW                                  │
│                                                                      │
│  [Player: Chọn venue → chọn field → chọn slot → bấm "Đặt sân"]     │
│                           │                                          │
│                           ▼                                          │
│  1. Frontend gửi POST /api/bookings                                 │
│     ├── Body: { fieldId, timeSlotId }                               │
│     ├── Header: Idempotency-Key (dedup bằng Redis)                  │
│     └── Auth: Clerk JWT                                             │
│                           │                                          │
│                           ▼                                          │
│  2. Backend xử lý (trong Prisma $transaction):                      │
│     ├── Validate: slot exists? belongs to field? status=AVAILABLE?  │
│     ├── Atomic update: VenueSlot.status → LOCKED (updateMany +     │
│     │   WHERE status='AVAILABLE', nếu count=0 → conflict)          │
│     ├── Create Booking (status=PENDING, expiresAt=now+5min)         │
│     └── Create BookingSlot (join table)                             │
│                           │                                          │
│                           ▼                                          │
│  3. BullMQ: addExpirationJob(bookingId, delay=15min)                │
│                           │                                          │
│                           ▼                                          │
│  4. Frontend tự động gọi POST /api/payments                        │
│     ├── Body: { bookingId, provider: "MOMO" }                      │
│     └── Header: Idempotency-Key                                    │
│                           │                                          │
│                           ▼                                          │
│  5. Backend tạo PaymentAttempt → gọi MoMo Sandbox API              │
│     ├── Sign request (HMAC-SHA256)                                  │
│     ├── Nhận paymentUrl từ MoMo                                    │
│     └── Trả về paymentUrl cho frontend                             │
│                           │                                          │
│                           ▼                                          │
│  6. Frontend redirect browser → MoMo payment page                  │
│                           │                                          │
│              ┌────────────┴────────────┐                            │
│              │                         │                             │
│              ▼                         ▼                             │
│  7a. MoMo IPN webhook             7b. User quay lại                │
│      POST /api/payments/               /payments/return             │
│      webhooks/momo                                                  │
│      ├── Verify signature                                           │
│      ├── Match attempt                                              │
│      ├── Check amount                                               │
│      └── Transaction:                                               │
│          ├── Attempt → PAID                                         │
│          ├── Payment → PAID                                         │
│          ├── Booking → CONFIRMED                                    │
│          └── Slots → BOOKED                                         │
│                                                                      │
│  [Nếu không thanh toán trong vòng 5 phút, BullMQ delayed job sẽ auto-cancel booking]                         │
│                           │                                          │
│                           ▼                                          │
│  8. BullMQ Processor chạy:                                          │
│     ├── Check: booking vẫn PENDING? payment chưa PAID?             │
│     ├── Transaction:                                                │
│     │   ├── Booking → CANCELLED (reason: AUTO_EXPIRED)             │
│     │   └── Slots LOCKED → AVAILABLE (release)                     │
│     └── Log kết quả                                                │
└──────────────────────────────────────────────────────────────────────┘
```

### 6.2 Luồng Owner confirm/cancel

```
Owner confirm:
  POST /api/bookings/:id/confirm
  → Verify ownership (VenueOwner.status = APPROVED)
  → Booking PENDING → CONFIRMED (optimistic lock)
  → Slots LOCKED → BOOKED

Owner cancel:
  POST /api/bookings/:id/cancel-by-owner
  → Verify ownership
  → Nếu CONFIRMED: phải trước 24h so với slot start time
  → Tính refund: >12h = 100%, >6h = 50%, ≤6h = 0%
  → Booking → CANCELLED
  → Slots → AVAILABLE (release)
  → Payment → REFUNDED_FULL hoặc REFUNDED_HALF (nếu có refund)
```

### 6.3 Luồng Walk-in (Staff)

```
Staff với permission CREATE_WALK_IN:
  POST /api/bookings/walk-in
  → Slot → BOOKED (skip LOCKED)
  → Booking status = CONFIRMED ngay lập tức
  → Payment method = CASH, status = PAID
  → Không có BullMQ expiration job
```

### 6.4 Các file implement chính

| Chức năng | File |
|---|---|
| Tạo booking | `apps/api/src/booking/booking.service.ts` — `createBookingOnce()` L96-186 |
| Confirm booking | `apps/api/src/booking/booking.service.ts` — `confirmBooking()` L188-259 |
| Cancel booking | `apps/api/src/booking/booking.service.ts` — `cancelBooking()` L261-392 |
| Tính refund | `apps/api/src/booking/booking.service.ts` — `getRefundPercent()` L552-559 |
| Booking idempotency | `apps/api/src/booking/booking-idempotency.service.ts` |
| BullMQ add job | `apps/api/src/queues/booking-expiration/booking-expiration.service.ts` |
| Auto-cancel processor | `apps/api/src/queues/booking-expiration/booking-expiration.processor.ts` |
| Tạo payment (MoMo) | `apps/api/src/payment/payment.service.ts` — `createPaymentForBooking()` L99-145 |
| MoMo provider | `apps/api/src/payment/providers/momo-payment.provider.ts` — 474 dòng |
| MoMo webhook processing | `apps/api/src/payment/payment.service.ts` — `processPaymentWebhook()` L269-398 |
| MoMo finalize success | `apps/api/src/payment/payment.service.ts` — `finalizeSuccessfulMomoWebhook()` L602-774 |
| Payment idempotency | `apps/api/src/payment/payment-initiation-idempotency.service.ts` |
| Frontend booking sheet | `apps/web/components/booking/booking-sheet.tsx` — 351 dòng |
| Frontend payment return | `apps/web/app/(main)/payments/return/page.tsx` — 11.5KB |

---

## 7. Đánh giá các tính năng (Có / Không / Một phần)

### 7.1 Bảng đánh giá

| # | Tính năng | Trạng thái | Bằng chứng từ mã nguồn |
|---|---|:---:|---|
| 1 | **Slot Grid (lưới chọn khung giờ)** | ⚠️ Một phần | `BookingSheet` hiển thị danh sách slot dạng grid 2 cột (`grid-cols-2`) với nút chọn. Tuy nhiên đây là danh sách slot của **1 field duy nhất** (field đầu tiên), **không phải lưới slot đa field** cho phép so sánh nhiều sân cùng lúc. Không có date picker — chỉ hiển thị slot cho ngày hôm nay. Xem: `apps/web/components/booking/booking-sheet.tsx` L300-331, `apps/web/app/(main)/venues/[id]/page.tsx` L80-87 |
| 2 | **Booking conflict handling** | ✅ Có | Xử lý đầy đủ ở tầng database: atomic `updateMany` với `WHERE status='AVAILABLE'` — nếu `count=0` thì throw `BadRequestException('Slot was taken concurrently')`. Có optimistic locking bằng field `version` + `assertOptimisticUpdate()`. Có idempotency key cho cả booking và payment (Redis-based). Xem: `apps/api/src/booking/booking.service.ts` L128-140, `apps/api/src/common/optimistic-lock.guard.ts` |
| 3 | **Payment countdown (đếm ngược thanh toán)** | ✅ Có | Frontend hiển thị UI countdown trong lịch sử booking PENDING dựa trên `expiresAt`; mock flow cũng đặt `expiresAt` 5 phút. |
| 4 | **Expired booking cancellation** | ✅ Có | BullMQ `booking-expiration` queue + `BookingExpirationProcessor`. Khi booking PENDING quá 5 phút (cấu hình qua `PAYMENT_HOLD_MINUTES`), processor tự động: cancel booking, release slots về AVAILABLE, skip nếu đã PAID. Xem: `apps/api/src/queues/booking-expiration/booking-expiration.processor.ts` (207 dòng) |
| 5 | **Admin booking management** | ✅ Có | Admin có trang `/admin/bookings` với `AdminBookingsTable` component. Backend `AdminService` + `AdminController` có endpoint xem booking toàn hệ thống. Xem: `apps/web/app/(main)/admin/bookings/page.tsx`, `apps/web/components/admin/admin-bookings-table.tsx` |
| 6 | **Owner booking management** | ✅ Có | Owner có trang `/owner/bookings` với `OwnerBookingsClient`, `BookingTable`, `BookingFilterTabs`. Backend hỗ trợ filter theo `status` và `date`. Owner có thể confirm (`POST :id/confirm`) và cancel (`POST :id/cancel-by-owner`). Xem: `apps/web/app/(main)/owner/bookings/page.tsx`, `apps/web/components/owner/owner-bookings-client.tsx`, `apps/api/src/booking/booking.controller.ts` |
| 7 | **Mobile app** | ❌ Không | Không có React Native, Flutter, hoặc bất kỳ mobile framework nào. Chỉ có responsive web. |
| 8 | **MoMo payment integration** | ✅ Có | MoMo sandbox đầy đủ: tạo payment attempt, HMAC-SHA256 signing, redirect to MoMo, IPN webhook verification + processing, finalize booking on success. Xem: `apps/api/src/payment/providers/momo-payment.provider.ts` (474 dòng), `apps/api/src/payment/payment.service.ts` (1120 dòng) |
| 9 | **VNPAY payment integration** | ❌ Không (stub) | File tồn tại nhưng chỉ là stub: `createPaymentAttempt()` trả URL sandbox giả, `verifyWebhook()` throw `NotImplementedException`. Xem: `apps/api/src/payment/providers/vnpay-payment.provider.ts` L48-53 |
| 10 | **Review system** | ✅ Có | Backend: eligibility check (cần booking COMPLETED), tạo review, lấy reviews theo venue, tính lại avg rating. Frontend: `VenueReviewsSection`, `ReviewForm`, `ReviewList`. Xem: `apps/api/src/review/review.service.ts`, `apps/web/components/review/` |
| 11 | **Staff management** | ✅ Có (backend) | Backend module đầy đủ: `StaffController` + `StaffService` + `StaffGuard` + `StaffPermission` enum. Staff endpoints cho confirm/cancel booking và walk-in. Frontend **chưa có** UI quản lý staff. |
| 12 | **Image upload** | ✅ Có | `UploadModule` với `UploadStorageService` hỗ trợ Supabase Storage. Frontend có `ImageUploader` component (8.1KB). |
| 13 | **Venue approval workflow** | ✅ Có | `VenueOwner` model với status PENDING → APPROVED/REJECTED. Admin có `VenueApprovalTable` (9KB) để duyệt/từ chối. |
| 14 | **Optimistic locking** | ✅ Có | Field `version` trên Venue, Field, Booking, Payment, VenueSlot. Utility `withOptimisticLock()` + `assertOptimisticUpdate()`. Dùng trong confirm, cancel, payment webhook. |

---

## 8. Danh sách thiếu / chưa hoàn chỉnh

### 8.1 Thiếu hoàn toàn (chưa có code)

| # | Hạng mục | Chi tiết |
|---|---|---|
| 1 | **Payment countdown UI** | Frontend hiển thị thời gian còn lại (countdown timer) trước khi booking hết hạn 5 phút bằng `expiresAt`. |
| 2 | **VNPAY integration thực tế** | `vnpay-payment.provider.ts` chỉ là stub — `verifyWebhook()` throw `NotImplementedException`, `createPaymentAttempt()` trả URL giả. |
| 3 | **Mobile application** | Không có ứng dụng di động (React Native, Flutter, hoặc tương tự). |
| 4 | **CI/CD pipeline** | Không có `.github/workflows/` hoặc bất kỳ CI/CD config nào. |
| 5 | **Automated tests** | Không tìm thấy file `*.spec.ts` hoặc `*.test.ts` nào ngoài boilerplate. Jest config tồn tại nhưng không có test cases. |
| 6 | **Staff management UI** | Backend staff module đầy đủ (controller, service, guard, permissions) nhưng frontend chưa có UI để OWNER mời/quản lý staff. |
| 7 | **Date picker cho booking** | Venue detail page chỉ hiển thị slot cho ngày hôm nay (`formatVietnamDateParam()`). Không có calendar/date picker để chọn ngày khác. |
| 8 | **Multi-field slot comparison** | BookingSheet chỉ hiển thị slot của field đầu tiên. Không có giao diện so sánh slot giữa nhiều field trong cùng venue. |
| 9 | **Notification system** | Không có email, SMS, hoặc push notification cho booking status changes. |
| 10 | **Payment reconciliation UI** | Backend có trạng thái `REQUIRES_RECONCILIATION` cho webhook mismatch nhưng không có admin UI để xử lý. |

### 8.2 Tồn tại nhưng chưa hoàn chỉnh

| # | Hạng mục | Chi tiết |
|---|---|---|
| 1 | **Slot grid** | Có grid 2 cột danh sách slot nhưng chỉ cho 1 field, chỉ ngày hôm nay. Chưa phải lưới slot đầy đủ (multi-field, multi-day). |
| 2 | **`packages/utils`** | Thư mục tồn tại nhưng hoàn toàn trống — không có code. |
| 3 | **`packages/typescript-config`** | Có shared TS configs nhưng cả `apps/api` và `apps/web` đều **không extend** từ package này — dùng standalone tsconfig riêng. |
| 4 | **Mock data** | `lib/mock-data.ts` (16KB) và `lib/mock-owner-bookings.ts` (9.7KB) vẫn tồn tại — booking sheet có logic đặc biệt xử lý mock field IDs (chứa `-field-`). Điều này cho thấy một số flow frontend vẫn dùng dữ liệu giả. |
| 5 | **Responsive UI** | Layout cơ bản responsive nhưng các component phức tạp (booking-sheet, owner tables, admin tables) cần polish thêm cho mobile viewport. |
| 6 | **Slot generation** | Schema có model `VenueSlot` nhưng **không tìm thấy** service/script tự động tạo slot theo lịch. Owner phải tạo slot thủ công hoặc qua seed script. |
| 7 | **Booking status: COMPLETED** | Backend hỗ trợ trạng thái `COMPLETED` trong enum nhưng **không tìm thấy** endpoint hoặc logic tự động chuyển từ `CONFIRMED → COMPLETED` sau khi trận đấu kết thúc. |
| 8 | **Refund thực tế** | Logic tính refund (`getRefundPercent()`) đầy đủ nhưng chỉ ghi vào DB — không có tích hợp thực tế với payment gateway để hoàn tiền. |
| 9 | **Node version mismatch** | `.mise.toml` = 22.14.0, `nixpacks.toml` = nodejs_22, Dockerfiles = `node:20-alpine`. Ba nguồn config không nhất quán. |

---

## Tóm tắt

DatSanVN là một nền tảng đặt sân thể thao trực tuyến với kiến trúc monorepo hiện đại (Turborepo + NestJS + Next.js + Prisma). Dự án có **backend hoàn chỉnh** với booking lifecycle, optimistic locking, BullMQ auto-cancel, và MoMo payment integration đầy đủ. Frontend có giao diện chức năng cho cả 3 role (Player, Owner, Admin).

Các điểm cần hoàn thiện chính:
- **Frontend UX**: thêm date picker, slot grid đa field, payment countdown
- **VNPAY**: implement đầy đủ (hiện chỉ là stub)
- **Testing**: chưa có automated tests
- **CI/CD**: chưa có pipeline
- **Staff UI**: backend sẵn sàng nhưng frontend chưa có

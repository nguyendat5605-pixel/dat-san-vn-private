# AGENTS.md — DatSanVN

> Đọc file này **trước tiên** trước khi làm bất kỳ task nào.
> Xem thêm `SKILL.md` để biết patterns và cách implement cụ thể.

---

## Stack

| Layer | Tech |
|---|---|
| **Frontend** | Next.js 15 (App Router) + TypeScript + Tailwind CSS + shadcn/ui |
| **Backend** | NestJS + TypeScript + Prisma ORM (v7) + PostgreSQL |
| **Auth** | Clerk (JWT + Webhooks) |
| **Monorepo** | Turborepo + pnpm workspaces |
| **Queue / Lock** | BullMQ + Redis (slot locking + booking expiration) |
| **DB (cloud)** | Supabase (PostgreSQL) |
| **Cache (cloud)** | Upstash (Redis) |

> ⚠️ **Không có Docker** — dev environment kết nối thẳng Supabase + Upstash qua `.env`.

---

## URLs (local dev)

- API: `http://localhost:3000/api`
- Frontend: `http://localhost:3001`
- Health: `http://localhost:3000/health`

---

## Project Structure

```
dat-san-vn/
├── apps/
│   ├── api/                  → NestJS backend
│   │   └── src/
│   │       ├── auth/         ✅ ClerkAuthGuard + RolesGuard + @CurrentUser()
│   │       ├── booking/      ✅ Full lifecycle CRUD + Optimistic Locking
│   │       ├── config/       ✅ BullMQ + Clerk + Redis configs
│   │       ├── field/        ✅ CRUD + Optimistic Locking
│   │       ├── queues/       ✅ BullMQ booking-expiration (auto-cancel 15p)
│   │       ├── review/       ✅ CRUD + eligibility check + rating recalc
│   │       ├── user/         ✅ CRUD + role management
│   │       ├── venue/        ✅ CRUD + ownership + approval + Optimistic Locking
│   │       └── webhooks/     ✅ Clerk user sync
│   └── web/                  → Next.js 15 frontend
│       └── app/
│           ├── (auth)/       ✅ Sign-in / Sign-up (Clerk)
│           ├── (main)/
│           │   ├── page.tsx          ✅ Trang chủ
│           │   ├── search/           ✅ Tìm kiếm sân
│           │   ├── venues/[id]/      ✅ Chi tiết sân + Review UI
│           │   ├── bookings/         ✅ Lịch sử booking (user)
│           │   ├── owner/            ✅ Owner Dashboard
│           │   └── admin/            ✅ Admin Panel
├── packages/
│   ├── types/                → Shared TypeScript types
│   └── utils/                → Shared utilities
```

---

## Feature Status

| Feature | Status | Ghi chú |
|---|:---:|---|
| Clerk Auth + Webhooks | ✅ | User sync Clerk ↔ DB ổn định |
| Venue CRUD | ✅ | List, detail, create, update, delete |
| Field CRUD | ✅ | Quản lý sân con trong venue |
| Booking lifecycle + BullMQ | ✅ | PENDING→CONFIRMED, auto-cancel 15p |
| Optimistic Locking | ✅ | Field `version` trên Venue, Field, Booking |
| Review System | ✅ | Backend module + Frontend, eligibility check, rating recalc |
| Owner Dashboard `/owner` | ✅ | Quản lý sân + booking của owner |
| Admin Panel `/admin` | ✅ | Quản lý user, duyệt sân, xem booking toàn hệ thống |
| Mobile UI responsive | 🔄 | Layout cơ bản có, cần polish các component phức tạp |
| Payment MoMo/VNPAY | ❌ | Chưa làm — có Enum + state logic, chưa tích hợp gateway |

---

## API Response Format (tuân thủ tuyệt đối)

```typescript
// Success
{ data: any; message: string; statusCode: number }

// Error
{ error: string; message: string; statusCode: number }
```

---

## Code Conventions

| Phạm vi | Convention |
|---|---|
| Database fields | `snake_case` |
| TypeScript code | `camelCase` |
| React components | `PascalCase` |
| Files | `kebab-case` |
| API calls | `fetch` với `credentials: "include"` |
| Auth header | Clerk JWT — `useAuth()` hook (Client), `auth()` (Server Component) |

---

## Roles & Permissions

```
USER   → Đặt sân, xem lịch sử booking của mình, viết review (nếu đã booking xong)
OWNER  → Quản lý venue/field của mình, confirm/cancel booking — phải được ADMIN duyệt
ADMIN  → Duyệt OWNER request, quản lý toàn bộ hệ thống
```

---

## Business Rules (không vi phạm)

- Booking states: `PENDING → CONFIRMED → COMPLETED | CANCELLED`
- Auto-cancel sau **15 phút** nếu vẫn `PENDING` (BullMQ)
- Slot lock **5 phút** khi user checkout (Redis TTL)
- Chủ sân chỉ được CANCEL trước **24h**
- Refund: **100%** nếu huỷ trước 12h, **50%** nếu trước 6h
- OWNER chỉ thao tác được trên venue/field của **chính mình**
- Review chỉ được tạo nếu user có booking `COMPLETED` tại venue đó

---

## API Endpoints

### Auth / User
```
GET    /api/users/me                      → Lấy thông tin user hiện tại
PATCH  /api/users/:id/role                → Đổi role (ADMIN only)
```

### Venue
```
GET    /api/venues                        → Danh sách sân (public)
GET    /api/venues/:id                    → Chi tiết sân (public)
POST   /api/venues                        → Tạo sân (OWNER)
PATCH  /api/venues/:id                    → Sửa sân (OWNER — sân của mình)
DELETE /api/venues/:id                    → Xoá sân (OWNER — sân của mình)
POST   /api/venues/:id/request-ownership  → Xin duyệt ownership (USER)
PATCH  /api/venues/:id/approve            → Duyệt venue (ADMIN)
PATCH  /api/venues/:id/reject             → Từ chối venue (ADMIN)
```

### Field
```
GET    /api/venues/:venueId/fields        → Danh sách field
POST   /api/venues/:venueId/fields        → Tạo field (OWNER)
PATCH  /api/venues/:venueId/fields/:id    → Sửa field (OWNER)
DELETE /api/venues/:venueId/fields/:id    → Xoá field (OWNER)
```

### Booking
```
GET    /api/bookings                      → Lịch sử (USER: của mình | OWNER: sân của mình)
GET    /api/bookings/:id                  → Chi tiết booking
POST   /api/bookings                      → Tạo booking (USER)
PATCH  /api/bookings/:id/confirm          → Xác nhận (OWNER)
PATCH  /api/bookings/:id/cancel           → Huỷ (USER hoặc OWNER tuỳ điều kiện)
```

### Review
```
POST   /api/reviews                       → Tạo review (USER — cần booking COMPLETED)
GET    /api/reviews/venue/:venueId        → Danh sách review của venue (public)
GET    /api/reviews/eligibility?venueId=  → Kiểm tra user có đủ điều kiện review không
```

---

## Frontend Components hiện có

```
components/
├── venue-card.tsx              → Card hiển thị venue
├── venue-list.tsx              → Danh sách venues
├── search-filters.tsx          → Bộ lọc tìm kiếm
├── booking-sheet.tsx           → Sheet đặt sân
├── booking-status-badge.tsx    → Badge trạng thái booking
└── bookings-list.tsx           → Danh sách booking
```

> Trước khi tạo component mới — **check thư mục này trước**.

---

## Còn lại cần làm

1. **Mobile UI Polish** — responsive cho các component phức tạp (booking-sheet, owner dashboard tables, admin panel)
2. **Payment Gateway** — tích hợp MoMo / VNPAY (có sẵn Enum + state logic, cần thêm module payment + webhook gateway)

---

## Quy tắc khi làm task

1. **Không thêm tính năng ngoài spec** — làm đúng những gì task yêu cầu
2. **Reuse components** — check `apps/web/components/` trước khi tạo mới
3. **Luôn dùng Clerk auth** — `useAuth()` cho Client Component, `auth()` cho Server Component
4. **Loading + Error states bắt buộc** — mọi page fetch data đều phải có `loading.tsx` hoặc skeleton
5. **TypeScript strict** — không dùng `any` trừ khi thực sự cần
6. **Verify sau task** — chạy `pnpm build` để đảm bảo không có lỗi TypeScript
7. **Optimistic Locking** — mọi PATCH/DELETE trên Venue, Field, Booking đều phải truyền `version`

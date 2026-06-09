# SKILL.md — Technical Playbook DatSanVN

> File này là "cẩm nang kỹ thuật" — đọc khi cần biết **cách implement** cụ thể.
> Không phải spec, không phải business rules — đó là việc của `AGENTS.md`.

---

## 1. Backend Patterns (NestJS + Prisma)

### 1.1 Optimistic Locking

Mọi entity quan trọng (Venue, Field, Booking) đều có field `version: Int @default(0)`.

**Khi UPDATE — luôn kiểm tra version:**

```typescript
// ✅ ĐÚNG
const updated = await this.prisma.venue.updateMany({
  where: { id, version },          // version phải khớp
  data: { ...dto, version: { increment: 1 } },
});

if (updated.count === 0) {
  throw new ConflictException('Dữ liệu đã bị thay đổi, vui lòng tải lại');
}
```

```typescript
// ❌ SAI — không check version
await this.prisma.venue.update({ where: { id }, data: dto });
```

**Frontend phải truyền `version` trong mọi PATCH request:**

```typescript
await fetch(`/api/venues/${id}`, {
  method: 'PATCH',
  body: JSON.stringify({ ...formData, version: venue.version }),
});
```

---

### 1.2 Prisma Transaction

Dùng `$transaction` khi có nhiều hơn 1 write operation liên quan nhau.

```typescript
// Ví dụ: Tạo booking + lock slot
const [booking] = await this.prisma.$transaction([
  this.prisma.booking.create({ data: bookingData }),
  this.prisma.slotLock.upsert({ ... }),
]);
```

> ⚠️ Prisma v7 dùng `pg` adapter — không dùng interactive transactions trên Edge Runtime.
> Nếu cần interactive transaction, để logic đó ở NestJS API (Node runtime), không để ở Next.js middleware.

---

### 1.3 Response Format — Luôn wrap

Mọi controller đều dùng format chuẩn. Không return raw object.

```typescript
// ✅
return { data: venue, message: 'Lấy thông tin sân thành công', statusCode: 200 };

// ❌
return venue;
```

---

### 1.4 Auth Decorators

```typescript
@Public()                          // Endpoint không cần login
@Roles(UserRole.ADMIN)             // Chỉ ADMIN
@Roles(UserRole.OWNER, UserRole.ADMIN)  // OWNER hoặc ADMIN

// Lấy user hiện tại trong controller
@Get('me')
getMe(@CurrentUser() user: User) { ... }
```

---

### 1.5 Thêm Module mới (checklist)

1. `nest g module <name>` — tạo module
2. `nest g controller <name>` — tạo controller
3. `nest g service <name>` — tạo service
4. Thêm Prisma model vào `schema.prisma`
5. Chạy `prisma migrate dev --name <tên migration>`
6. Import module vào `app.module.ts`
7. Export service nếu module khác cần dùng

---

## 2. Authentication & Authorization

### 2.1 Frontend — Lấy Clerk JWT

```typescript
// Client Component
const { getToken } = useAuth();

const res = await fetch('/api/bookings', {
  headers: {
    Authorization: `Bearer ${await getToken()}`,
  },
});
```

```typescript
// Server Component / Route Handler
import { auth } from '@clerk/nextjs/server';

const { getToken } = auth();
const token = await getToken();
```

---

### 2.2 Kiểm tra Role ở Frontend

```typescript
import { useUser } from '@clerk/nextjs';

const { user } = useUser();
const role = user?.publicMetadata?.role as string; // 'USER' | 'OWNER' | 'ADMIN'
```

> Role được set trong Clerk `publicMetadata` thông qua webhook sync.

---

### 2.3 Bảo vệ Route ở Next.js

Dùng middleware hoặc check trong Server Component:

```typescript
// app/(main)/admin/page.tsx
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function AdminPage() {
  const { userId, sessionClaims } = auth();
  if (!userId || sessionClaims?.metadata?.role !== 'ADMIN') {
    redirect('/');
  }
  // ...
}
```

---

## 3. Frontend Patterns (Next.js 15)

### 3.1 Server vs Client Component

| Dùng Server Component khi | Dùng Client Component khi |
|---|---|
| Fetch data ban đầu (SEO, performance) | Cần `useState`, `useEffect` |
| Không cần interactivity | Cần event handlers (onClick, onChange) |
| Dùng `auth()` từ Clerk server | Dùng `useAuth()`, `useUser()` |
| Không cần browser APIs | Cần browser APIs (localStorage, etc.) |

> **Mặc định Server Component** — chỉ thêm `'use client'` khi thực sự cần.

---

### 3.2 Loading & Error States (bắt buộc)

Mọi route fetch data đều phải có:

```
app/(main)/venues/
├── page.tsx          → Nội dung chính
├── loading.tsx       → Skeleton khi đang fetch
└── error.tsx         → UI khi fetch lỗi
```

```typescript
// loading.tsx mẫu
export default function Loading() {
  return (
    <div className="grid grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-48 rounded-xl" />
      ))}
    </div>
  );
}
```

---

### 3.3 Form Pattern — react-hook-form + zod

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1, 'Tên không được để trống'),
  price: z.number().positive('Giá phải lớn hơn 0'),
});

type FormData = z.infer<typeof schema>;

const form = useForm<FormData>({ resolver: zodResolver(schema) });
```

---

### 3.4 Toast Notifications

```typescript
import { toast } from 'sonner'; // hoặc shadcn/ui toast

toast.success('Đặt sân thành công!');
toast.error('Có lỗi xảy ra, vui lòng thử lại');
```

---

### 3.5 Thêm trang Dashboard mới (checklist)

1. Tạo `app/(main)/<route>/page.tsx` — Server Component, check auth/role
2. Tạo `app/(main)/<route>/loading.tsx` — Skeleton
3. Tạo `app/(main)/<route>/error.tsx` — Error UI
4. Fetch data trong Server Component, pass xuống Client Component nếu cần interactivity
5. Reuse components trong `components/` trước khi tạo mới

---

## 4. BullMQ & Redis

### 4.1 Queue hiện có

| Queue | Job | Trigger | Hành động |
|---|---|---|---|
| `booking-expiration` | `expire-booking` | Tạo booking PENDING | Auto-cancel sau 15 phút |

### 4.2 Debug queue không chạy

```bash
# Kiểm tra worker có đang chạy không
# Xem log NestJS — tìm dòng "BookingExpirationWorker"

# Kiểm tra Redis connection
# Check UPSTASH_REDIS_URL trong .env có đúng không

# Test manual: cancel booking thủ công qua API
PATCH /api/bookings/:id/cancel
```

### 4.3 Slot Lock

- TTL: **5 phút** — sau khi hết TTL, slot được giải phóng tự động
- Key format: `slot-lock:<fieldId>:<date>:<timeSlot>`

---

## 5. Database Gotchas

### 5.1 Prisma v7 + Supabase

- Dùng `@prisma/adapter-pg` — không dùng Prisma default connector
- Connection string lấy từ Supabase dashboard — dùng **Transaction Pooler** (port 6543) cho serverless, **Direct** (port 5432) cho migration

```env
DATABASE_URL="postgresql://..."       # Direct — dùng cho prisma migrate
DIRECT_URL="postgresql://..."         # Transaction pooler — dùng runtime
```

### 5.2 Prisma Schema Conventions

```prisma
model Venue {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  version   Int      @default(0)       // Optimistic locking
  
  @@map("venues")  // table name snake_case
}
```

### 5.3 Migration Workflow

```bash
# Sửa schema → tạo migration
pnpm --filter api exec prisma migrate dev --name <mô tả ngắn>

# Deploy lên production (Supabase)
pnpm --filter api exec prisma migrate deploy

# Regenerate Prisma Client sau khi sửa schema
pnpm --filter api exec prisma generate
```

---

## 6. Monorepo Commands

```bash
# Dev toàn bộ stack
pnpm dev

# Build (verify không có TypeScript error)
pnpm build

# Chỉ chạy API
pnpm --filter api dev

# Chỉ chạy Web
pnpm --filter web dev

# Add package vào app cụ thể
pnpm --filter api add <package>
pnpm --filter web add <package>

# Add shared package
pnpm --filter packages/types add <package>
```

---

## 7. Payment Integration (TODO)

> Module này chưa implement. Đây là hướng dẫn khi bắt đầu làm.

### Cấu trúc đề xuất

```
src/payment/
├── payment.module.ts
├── payment.controller.ts     → /api/payment/create, /api/payment/callback
├── payment.service.ts        → Logic tạo payment URL, verify signature
├── providers/
│   ├── momo.provider.ts
│   └── vnpay.provider.ts
```

### Flow cơ bản

```
User confirm booking
  → POST /api/payment/create { bookingId, provider: 'MOMO' | 'VNPAY' }
  → Backend tạo payment URL, trả về redirect URL
  → Frontend redirect user sang cổng thanh toán
  → Gateway callback → POST /api/payment/callback
  → Backend verify signature → update booking status
```

### Lưu ý

- **Luôn verify HMAC signature** từ callback — không trust data thô
- Callback URL phải public (không cần auth) — dùng `@Public()`
- Idempotent: callback có thể gọi nhiều lần — check `paymentStatus` trước khi update

---

## 8. Common Pitfalls

| Lỗi hay gặp | Nguyên nhân | Fix |
|---|---|---|
| `409 Conflict` khi update | Version mismatch (Optimistic Locking) | Fetch lại data mới nhất rồi retry |
| Booking không tự cancel | BullMQ worker chưa chạy | Kiểm tra log NestJS, check Redis connection |
| `401 Unauthorized` | Thiếu Authorization header | Dùng `getToken()` từ Clerk trước khi gọi API |
| Prisma generate error | Schema thay đổi chưa generate lại | Chạy `prisma generate` |
| `NEXT_PUBLIC_*` undefined | Biến env thiếu prefix | Biến dùng ở client PHẢI có prefix `NEXT_PUBLIC_` |

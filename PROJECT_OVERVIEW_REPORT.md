# Báo cáo tổng quan Project DatSanVN

## 1. Executive Summary

- **Project là gì?** DatSanVN là nền tảng đặt sân thể thao trực tuyến (chủ yếu là sân bóng đá), cho phép người chơi tìm kiếm, xem slot trống và đặt sân theo thời gian thực.
- **Giai đoạn hiện tại:** Dự án đang ở mức **MVP (Minimum Viable Product) / Demo**. Các luồng cơ bản từ xác thực, tạo sân, quản lý slot, đặt sân, và đánh giá (review) đã hoàn thiện. Hệ thống chưa tích hợp cổng thanh toán thực tế (MoMo/VNPAY) nên chưa sẵn sàng đưa ra production.
- **Vai trò chính:** 
  - **PLAYER (Người chơi):** Tìm kiếm sân, đặt sân, xem lịch sử, viết đánh giá.
  - **OWNER (Chủ sân):** Tạo và quản lý sân của mình, duyệt hoặc hủy booking. Cần được ADMIN duyệt quyền sở hữu (ownership).
  - **ADMIN (Quản trị viên):** Quản lý toàn hệ thống, duyệt sân/chủ sân.
  - **STAFF (Nhân viên):** Mới được thêm vào schema (mô hình `VenueStaff` scope theo từng venue) để quản lý ca trực, tạo walk-in booking, thu tiền.
- **Nhận định nhanh:** Project có kiến trúc monorepo hiện đại, sử dụng NestJS và Next.js kết hợp Prisma rất chuẩn chỉ. Cách xử lý Optimistic Locking và Booking Expiration (BullMQ) cho thấy tư duy thiết kế backend khá tốt. Tuy nhiên, phần Frontend (đặc biệt là Mobile UI) và một số kiểu dữ liệu DB (lưu mảng dạng chuỗi chưa đồng nhất) vẫn còn nợ kỹ thuật (technical debt) cần giải quyết.

---

## 2. Kiến trúc tổng thể

Dự án sử dụng mô hình **Monorepo** quản lý bằng **Turborepo** và **pnpm workspaces**, giúp dễ dàng chia sẻ code, type và utilities giữa Frontend và Backend.

* **`apps/web`**: Ứng dụng Frontend viết bằng Next.js 15 (App Router). Xử lý giao diện người dùng, gọi API, và quản lý state.
* **`apps/api`**: Ứng dụng Backend viết bằng NestJS. Cung cấp RESTful APIs, xử lý logic nghiệp vụ, giao tiếp DB và quản lý Background Jobs.
* **`packages/types`**: Chứa các interface, type, và enum dùng chung (VD: `ApiResponse`, `CreateVenuePayload`) giúp đồng bộ chặt chẽ contract giữa FE và BE.
* **`packages/utils`**: Chứa các hàm tiện ích dùng chung (hiện tại chưa implement nhiều).

**Cách giao tiếp:**
- **Frontend ↔ Backend:** Next.js gọi NestJS API thông qua `fetch` với Header chứa Clerk JWT Token (`Authorization: Bearer <token>`). Các component phía client dùng `useAuth()` để lấy token.
- **Backend ↔ Database:** NestJS dùng Prisma ORM để giao tiếp trực tiếp với PostgreSQL (Supabase).

**Sơ đồ luồng:**
```txt
Browser (Next.js Client) → Next.js SSR / Server Actions → NestJS API → Prisma ORM → PostgreSQL (Supabase)
          ↓                                                 ↓                 ↓
      Clerk Auth                                        Redis (BullMQ)    Clerk Webhook (Sync User)
```

---

## 3. Công nghệ sử dụng

| Công nghệ | Dùng ở đâu | Vai trò | Nhận xét |
| --------- | ---------- | ------- | -------- |
| **Next.js 15** | `apps/web` | Framework Frontend chính (App Router) | Tận dụng tốt Server Components để SEO và lấy data ban đầu. |
| **React** | `apps/web` | UI Library | Dùng linh hoạt kết hợp với shadcn/ui. |
| **TypeScript** | Toàn bộ project | Type checking | Code strict, định nghĩa type rất chặt với `packages/types`. |
| **Tailwind CSS** | `apps/web` | Styling & UI | Kết hợp shadcn/ui giúp dựng UI nhanh, thống nhất. |
| **NestJS** | `apps/api` | Framework Backend | Cấu trúc module rõ ràng, DTO/Validation tốt qua class-validator. |
| **Prisma (v7)** | `apps/api` | Database ORM | Schema định nghĩa rành mạch, hỗ trợ migration cực mượt. |
| **PostgreSQL** | Supabase | Database chính | Lưu toàn bộ dữ liệu nghiệp vụ (User, Venue, Booking). |
| **pnpm + Turborepo** | Root | Monorepo tool | Quản lý dependencies nhanh, build caching tối ưu. |
| **Multer** | `apps/api/upload` | Upload file nội bộ | Đang dùng diskStorage lưu file tạm vào folder `/uploads`. |
| **Clerk** | FE & BE | Authentication | JWT authentication, webhook sync user sang DB rất ổn. |
| **BullMQ & Redis** | `apps/api/queues` | Queue / Jobs | Quản lý timer 5 phút auto-cancel booking rất mượt mà. |

---

## 4. Cấu trúc thư mục

### `apps/web`
- **Chức năng:** Chứa code Frontend.
- **File/Thư mục quan trọng:**
  - `app/(main)`: Chứa các route chính (trang chủ, tìm kiếm, chi tiết sân).
  - `app/admin`, `app/owner`: Dashboard quản lý phân quyền.
  - `components/`: Chứa UI tái sử dụng (như `venue-card.tsx`, `booking-sheet.tsx`).
- **Vấn đề cần refactor:** Giao diện đang thiếu loading skeleton cho một số fetch logic client, `components` hơi rải rác.

### `apps/api`
- **Chức năng:** Chứa code Backend (NestJS).
- **File/Thư mục quan trọng:**
  - `src/venue`, `src/booking`, `src/user`: Các domain module lõi.
  - `src/common/optimistic-lock.guard.ts`: Hàm custom xử lý khóa lạc quan (optimistic locking) khi đặt sân.
  - `prisma/schema.prisma`: Nơi cấu hình toàn bộ Database.
- **Vấn đề cần refactor:** Response chưa đồng nhất tuyệt đối ở một số module nhỏ, cần chuyển việc lưu ảnh từ local disk (Multer) sang Cloud Storage (AWS S3/Cloudinary) cho production.

### `packages/types`
- **Chức năng:** Nơi tập trung toàn bộ TypeScript Types, Enums được chia sẻ.
- **File quan trọng:** `src/index.ts` (định nghĩa `ApiResponse`, DTOs).

### `packages/utils`
- **Chức năng:** Tiện ích dùng chung nhưng hiện tại chưa được sử dụng sâu.

---

## 5. Database & Prisma Schema

File `schema.prisma` được thiết kế rất chi tiết (v1.3), có nhiều điểm nổi bật:

* **Các model chính:** `User`, `Venue`, `Field` (Sân con), `VenueSlot` (Slot giờ), `Booking`, `Review`, `Payment`, `VenueStaff`.
* **Quan hệ:**
  - Một `User` có thể làm `VenueOwner` (sở hữu nhiều `Venue`).
  - Một `Venue` có nhiều `Field` (Sân 5, Sân 7).
  - Một `Field` có nhiều `VenueSlot` (Khung giờ) và `Booking`.
  - Một `VenueStaff` liên kết `User` vào một `Venue` với mảng `StaffPermission`.
* **Field quan trọng của Venue:**
  - `images`, `amenities`: Lưu dạng `String[]`. (Điểm yếu: Dễ bị lỗi parsing nếu lưu json text không chuẩn từ trước).
  - `pricePerHour`: Kiểu `Decimal` (chuẩn cho tài chính).
  - `status` (`isActive`): Dùng để ADMIN duyệt sân hiển thị.
  - `version`: Cực kỳ quan trọng để áp dụng Optimistic Locking, tránh conflict ghi đè song song.
* **Field quan trọng của Booking:**
  - Trạng thái `PENDING → CONFIRMED → COMPLETED | CANCELLED`.
  - `version` để chặn race condition khi confirm/cancel.
* **Điểm mạnh:** Sử dụng Optimistic Locking thông minh (bằng trường `version`). Cascading delete chặt chẽ.
* **Điểm yếu:** `images` (thay vì tách model riêng `VenueImage`) đôi lúc dẫn đến lỗi dữ liệu (`JSON.parse error`) ở frontend khi định dạng trả về bị hỏng.

---

## 6. Backend NestJS

Các module được chia chuẩn theo tính năng (Domain-Driven Design nhẹ):

* **`VenueModule`**: 
  - **Endpoint:** `GET /venues`, `POST /venues`, `PATCH /venues/:id/approve`...
  - **Role:** OWNER tạo, ADMIN duyệt.
  - **Rủi ro:** Cần handle parse chuỗi JSON của `images` cẩn thận (đã dùng `safeJsonParse`).
* **`BookingModule`**:
  - **Endpoint:** `POST /bookings`, `PATCH /bookings/:id/confirm`, `PATCH /bookings/:id/cancel`.
  - **Role:** PLAYER đặt, OWNER confirm.
  - **Đặc điểm:** Dùng `$transaction` và `withOptimisticLock` khóa `VenueSlot` sang `LOCKED`.
* **`ReviewModule`**:
  - **Chức năng:** Tạo review sau khi đá xong (booking `COMPLETED`).
  - **File:** `review.service.ts` (cập nhật rating trung bình của venue).
* **`UploadModule`**:
  - **Chức năng:** Xử lý `POST /upload`. Dùng Multer cấu hình `diskStorage` lưu vào `/uploads`.
  - **Rủi ro:** Hiện đang lưu ổ cứng server (Local). Nếu deploy serverless (Vercel) ảnh sẽ bị mất. Cần thay bằng Cloud Storage.
* **`Auth / Webhook`**:
  - Webhook nhận event từ Clerk để tạo/cập nhật `User` trong DB tự động.
* **`Queue` (Booking Expiration)**:
  - Dùng BullMQ, khi tạo booking thành công sẽ đẩy 1 job delay 5 phút. Sau 5p nếu status vẫn `PENDING` sẽ tự chuyển `CANCELLED` và trả slot về `AVAILABLE`.

---

## 7. Frontend Next.js

* **Trang chủ (`/`)**: Giao diện đẹp, dynamic với hiệu ứng chuyển màu, dùng Server Component fetch `getFeaturedVenues`.
* **Trang chi tiết sân (`/venues/[id]`)**: 
  - Gọi API lấy data sân, danh sách sân con (`fields`) và slot khả dụng.
  - Maps dữ liệu an toàn để chống lỗi array (fallback bằng default arrays).
  - Chứa `VenueGallery` và `BookingSheet`.
* **Trang booking (`booking-sheet.tsx`)**: 
  - Component dạng Sheet (Slide từ phải sang). Nhận ID sân con, slot giờ và giá. Gọi API `createPlayerBooking`.
* **Trang Owner / Admin Dashboard**: 
  - Dùng bảng (table) để duyệt sân và xem thống kê (chưa responsive 100% trên Mobile).
* **Vấn đề UI/UX:**
  - Fallback/loading states chưa được phủ 100% (cần thêm `loading.tsx` cho các page con).
  - Component `booking-sheet` đôi khi báo "Chưa có slot khả dụng" nếu API lỗi, chưa có fallback UX thân thiện.

---

## 8. Các flow vận hành chính

### 8.1 Flow tạo sân
1. OWNER đăng nhập, mở `VenueForm`.
2. Nhập thông tin, có thể upload ảnh (`ImageUploader`).
3. Frontend submit payload lên `POST /api/venues`.
4. API validate, lưu Prisma. Mặc định `isActive = false`, tạo `VenueOwner` với status `PENDING`.
5. ADMIN vào trang quản lý duyệt (`PATCH /approve`).
6. Venue hiển thị public.

### 8.2 Flow upload ảnh
1. Browser gửi file hình dạng `FormData` lên `POST /api/upload`.
2. Multer (NestJS) can thiệp, filter MIME type (chỉ nhận `image/jpeg, png, webp`), validate size (< 5MB).
3. Đổi tên file ngẫu nhiên và lưu vào folder `/uploads`.
4. Trả về absolute URL. Frontend lấy URL này push vào mảng `images` của Venue payload.

### 8.3 Flow xem chi tiết sân
1. Người dùng vào `/venues/123`. Next.js SSR gọi `getVenueDetail(123)`.
2. Backend trả về JSON.
3. Frontend mapping: `images` được bóc ra thành `heroImage` (ảnh 0) và `gallery` (phần còn lại).
4. Nếu DB bị lỗi lưu `images` là chuỗi thường, `safeJsonParse` ở backend đã cứu cánh và trả về Array hợp lệ. Frontend render component gallery.

### 8.4 Flow booking
1. User xem `/venues/:id`, click vào 1 slot giờ (hiện badge).
2. Bấm "Đặt sân", mở `BookingSheet`. Xác nhận giá.
3. Bấm Submit -> Gọi BE `POST /bookings`.
4. BE chạy Transaction: Tìm slot -> verify `AVAILABLE` -> update thành `LOCKED` (tăng `version`) -> Tạo `Booking (PENDING)`.
5. Đẩy job vào BullMQ. User có 5 phút để chủ sân Confirm hoặc Thanh toán.
6. Hết 5 phút, Queue xử lý, nếu vẫn PENDING -> `CANCELLED`, slot về `AVAILABLE`.

---

## 9. Các lỗi đã gặp / rủi ro kỹ thuật

| Tên lỗi | Nguyên nhân gốc | File liên quan | Cách xử lý đã thực hiện / Cần làm |
|---------|-----------------|----------------|-----------------------------------|
| **`JSON.parse: unexpected character`** | Dữ liệu `images`/`amenities` lúc seed/tạo bị sai định dạng JSON. API trả về HTML thay vì JSON khi lỗi 500. | `venue.service.ts`, `api-client` | Đã thêm hàm `safeJsonParse` và `safeArray` để ép kiểu. Chặn lỗi từ mầm. |
| **`venue.gallery is not iterable`** | Tương tự trên, `gallery` bị null/undefined khi parse hỏng. | `venue-gallery.tsx` | Đã thêm fallback `Array.isArray(venue.gallery) ? venue.gallery : []`. |
| **Upload lỗi MIME type** | File gửi lên có mimetype rỗng hoặc lạ. | `upload.controller.ts` | Đã log rõ mimetype và check `ALLOWED_MIME_TYPES`. |
| **Race condition Navbar** | Webhook Clerk cập nhật Role vào DB mất vài giây. Frontend redirect ngay nên BE báo "User not found". | `users/me` API | Đã thêm retry logic (Polly pattern) vào `getCurrentUserProfile` chờ user đồng bộ. |
| **Upload file lên Vercel mất ảnh** | Vercel là môi trường Serverless (chỉ đọc ổ đĩa gốc). Thư mục `/uploads` sẽ bay màu sau mỗi lần spin-up. | `UploadModule` | **Bắt buộc:** Phải tích hợp AWS S3, Cloudinary hoặc Supabase Storage cho giai đoạn tiếp. |

---

## 10. Đánh giá code quality

| Hạng mục               | Điểm | Nhận xét |
| ---------------------- | ---: | -------- |
| Kiến trúc              |  9/10| Monorepo, NestJS + Next.js cực chuẩn chỉnh và dễ scale. |
| TypeScript typing      | 8.5/10| Dùng shared `types` tốt, nhưng đôi chỗ frontend ép kiểu `as BookableField` hơi khiên cưỡng. |
| Backend validation     |  9/10| Validator chặt, có Optimistic Lock (hiếm thấy ở dự án vừa). |
| Frontend data handling |  7/10| Còn khá nhiều logic fallback (mock) bọc cứng ở component. |
| UI/UX                  |  8/10| Rất đẹp và hiện đại (shadcn/ui), nhưng Mobile UI cho Dashboard chưa tối ưu. |
| Database design        | 8.5/10| Khá hoàn chỉnh. Điểm trừ nhỏ là mảng `String[]` lưu text cần migrate sang JsonB hoặc bảng liên kết. |

**Nhận xét chung:** 
Code backend cực kỳ mạnh ở khoản thiết kế concurrency (Optimistic Locking, Transaction, Redis Queue). Frontend dựng UI nhanh, đẹp. Chỗ yếu nhất là luồng xử lý Data ở Frontend (quá nhiều nullable, mock fallback đan xen) và việc quản lý hình ảnh.

---

## 11. Roadmap phát triển tiếp theo

### Ngắn hạn (Để Demo hoàn hảo)
- Cập nhật luồng Upload Ảnh sử dụng Supabase Storage hoặc Cloudinary (cực kỳ gấp vì deploy sẽ hỏng ảnh).
- Viết file `loading.tsx` cho các page `(main)`.
- Xóa các mock data cứng trong `BookingSheet`.
- Responsive cho các bảng quản lý của ADMIN / OWNER.

### Trung hạn (Tiến tới Release)
- Tích hợp cổng thanh toán (MoMo / VNPAY) - Đã có Enum chờ sẵn.
- Tính năng đánh giá (Review) hoàn chỉnh cho User sau khi `COMPLETED`.
- Biểu đồ thống kê doanh thu cho Dashboard của Chủ Sân.
- Tích hợp gửi Email notification (Resend/SendGrid) khi đặt sân thành công.

### Dài hạn (Mở rộng tính năng)
- Bản đồ tích hợp Google Maps xịn (hiện tại là placeholder map).
- Xây dựng hệ thống Chat trực tiếp Player ↔ Owner.
- SEO Landing page theo từng quận (vd: Đặt sân bóng đá Quận 7).
- Ứng dụng Mobile App (React Native) tái sử dụng API NestJS.

---

## 12. Kết luận

Project DatSanVN hiện tại **đã đạt mức độ Demo xuất sắc** cho các flow cốt lõi (Core flows). Cấu trúc hạ tầng (Infrastructure) rất vững chãi với Monorepo và NestJS/Prisma. Tuy nhiên, nó **chưa đủ để lên Production** do thiếu cổng thanh toán thực tế và giải pháp lưu trữ hình ảnh Cloud vĩnh viễn.

**3 việc quan trọng nhất cần làm ngay:**
1. Cấu hình Upload Ảnh lên Cloud (Supabase Storage).
2. Tích hợp thanh toán MoMo / VNPAY.
3. Clean dứt điểm các dữ liệu Mock ở Frontend và handle Loading State đồng bộ.

---

## 13. Checklist việc cần làm tiếp

```md
- [ ] Refactor `UploadModule` sang sử dụng Cloudinary / Supabase Storage.
- [ ] Thêm `loading.tsx` và Skeleton UI cho các component phía Next.js.
- [ ] Dọn dẹp Mock data trong `BookingSheet` (`localStorage.getItem("mock_bookings")`).
- [ ] Tích hợp API MoMo/VNPAY và xử lý Webhook thanh toán.
- [ ] Review lại giao diện Mobile cho `/admin` và `/owner`.
- [ ] Đồng bộ lại cách lưu `images` trong DB (cân nhắc đổi sang JsonB hoặc bảng riêng để dứt điểm lỗi parse).
```

# Phụ lục: Các Đoạn Mã Nguồn Tiêu Biểu (Code Candidates)

Phụ lục này trích xuất các đoạn mã nguồn quan trọng từ hệ thống DatSanVN nhằm minh chứng cho việc hệ thống đã đáp ứng các yêu cầu nghiệp vụ phức tạp, đặc biệt là các vấn đề liên quan đến đồng thời (concurrency) và xử lý luồng tự động (background processing).

---

## TC-01: Ngăn chặn Đặt trùng lịch (Double Booking / Booking Conflict)

Để giải quyết bài toán đặt trùng lịch khi có nhiều người dùng cùng chọn một khung giờ, hệ thống áp dụng cơ chế Cập nhật nguyên tử (Atomic Update) kết hợp với Khóa lạc quan (Optimistic Locking) bên trong một Transaction của cơ sở dữ liệu. Cơ chế này đảm bảo tính nhất quán mà không làm giảm hiệu năng hệ thống.

### 1. Cấu hình Khóa lạc quan (Optimistic Locking) trên Schema
**File:** `apps/api/prisma/schema.prisma`
**Model:** `VenueSlot` và `Booking`

```prisma
model VenueSlot {
  id           String     @id @default(uuid())
  fieldId      String     @map("field_id")
  // ... các trường khác
  status       SlotStatus @default(AVAILABLE)
  version      Int        @default(1) // Trường phục vụ Optimistic Locking
  updatedAt    DateTime   @updatedAt @map("updated_at")
}
```

**Giải thích học thuật:** Trường `version` hoạt động như một cờ hiệu để theo dõi phiên bản của bản ghi. Khi dữ liệu được cập nhật, `version` sẽ tự động tăng lên. Điều này giúp phát hiện ra các thay đổi cạnh tranh.
**Quy tắc nghiệp vụ được chứng minh:** Thiết lập nền tảng dữ liệu để ngăn chặn ghi đè dữ liệu bất đồng bộ.

### 2. Guard bảo vệ cập nhật đồng thời
**File:** `apps/api/src/common/optimistic-lock.guard.ts`
**Hàm:** `assertOptimisticUpdate`

```typescript
export function assertOptimisticUpdate(
  result: { count: number },
  errorMessage = DEFAULT_OPTIMISTIC_LOCK_MESSAGE,
) {
  if (result.count === 0) {
    throw new BadRequestException(errorMessage);
  }
}
```

**Giải thích học thuật:** Hàm này kiểm tra số lượng bản ghi thực tế được thay đổi bởi lệnh `updateMany`. Nếu `count === 0`, có nghĩa là điều kiện `WHERE` (thường bao gồm kiểm tra `status` hoặc `version` cũ) không còn thoả mãn do một giao dịch (transaction) khác đã can thiệp trước, hàm sẽ văng lỗi (throw exception) để huỷ toàn bộ quá trình.

### 3. Quy trình Đặt sân và Khóa khung giờ nguyên tử
**File:** `apps/api/src/booking/booking.service.ts`
**Hàm:** `createBookingOnce`

```typescript
    // 1. Kiểm tra trạng thái hiện tại của slot (đọc dữ liệu)
    const slot = await this.prisma.venueSlot.findUnique({
      where: { id: dto.timeSlotId },
      include: { field: { include: { venue: true } } },
    });

    if (slot.status !== 'AVAILABLE') {
      throw new BadRequestException('Time slot is no longer available');
    }

    // 2. Thực thi Transaction để tạo booking và khóa slot
    const booking = await this.prisma.$transaction(async (tx) => {
      // Xác minh khắt khe (Strict Verification) bằng Cập nhật nguyên tử (Atomic Update)
      const updatedSlot = await tx.venueSlot.updateMany({
        where: { id: slot.id, status: 'AVAILABLE' }, // Điều kiện Race-condition guard
        data: {
          status: isWalkIn ? 'BOOKED' : 'LOCKED',
          version: { increment: 1 }, // Tăng version để khóa lạc quan
        },
      });

      // Nếu không cập nhật được bản ghi nào, tức là có người khác đã lấy slot này trước
      if (updatedSlot.count === 0) {
        throw new BadRequestException(
          'Slot was taken concurrently or is no longer available',
        );
      }

      // Tạo Booking an toàn sau khi đã chắc chắn khóa được slot
      const newBooking = await tx.booking.create({
        data: {
          userId,
          venueId,
          status: isWalkIn ? BookingStatus.CONFIRMED : BookingStatus.PENDING,
          totalPrice,
          expiresAt,
          bookingSlots: {
            create: { venueSlotId: slot.id },
          },
        },
      });

      return newBooking;
    });
```

**Giải thích học thuật:** 
- Đoạn mã sử dụng `tx.venueSlot.updateMany` thay vì `update` thông thường để tận dụng câu lệnh SQL `UPDATE ... WHERE status = 'AVAILABLE'`. Đây là thao tác cập nhật nguyên tử ở cấp độ CSDL.
- Dù cho Bước 1 (`findUnique`) báo là `AVAILABLE`, nếu tại thời điểm chính xác câu lệnh UPDATE chạy mà `status` đã bị đổi bởi user khác, thì `count` sẽ bằng `0`.
- Ngay khi `count === 0`, `BadRequestException` sẽ kích hoạt cơ chế Rollback của Database Transaction, đảm bảo không có Booking rác nào được sinh ra.
**Quy tắc nghiệp vụ được chứng minh:** Đảm bảo nguyên tắc độc quyền (mutual exclusion) trên mỗi khung giờ sân, triệt tiêu hoàn toàn khả năng Double Booking.
**Lưu ý kỹ thuật:** Không sử dụng khoá bi quan ở mức dòng (`SELECT FOR UPDATE`) để tránh tình trạng thắt cổ chai (bottleneck) và bế tắc (deadlock) trong hệ thống có lưu lượng cao, thay vào đó dùng cơ chế an toàn và nhẹ hơn là Atomic Update.

### 4. Sử dụng Idempotency Key bảo vệ đường truyền
**File:** `apps/api/src/booking/booking.service.ts`
**Hàm:** `createBooking`

```typescript
    const idempotency = await this.bookingIdempotencyService.startOrGet(
      userId,
      dto,
      idempotencyKey,
    );

    if (idempotency.type === 'succeeded') {
      return idempotency.response; // Trả về kết quả cũ nếu retry
    }
```

**Giải thích học thuật:** Áp dụng tính lũy đẳng (Idempotency) dựa trên Redis. Nếu phía client bị rớt mạng và ấn "Đặt sân" nhiều lần liên tiếp với cùng một payload, hệ thống chỉ xử lý 1 lần duy nhất, ngăn chặn lỗi logic từ lớp ứng dụng (application layer).

---

## TC-02: Tự động Hủy Đặt sân khi Hết hạn (Timeout Rollback)

Yêu cầu nghiệp vụ: Nếu người dùng không hoàn tất thanh toán trong vòng 5 phút, hệ thống tự động hủy booking để nhường sân cho người khác. Hủy tự động (rollback) giúp hệ thống không bị chiếm dụng tài nguyên rác.

### 1. Lập lịch công việc giải phóng (Delayed Job)
**File:** `apps/api/src/queues/booking-expiration/booking-expiration.service.ts`
**Hàm:** `addExpirationJob`

```typescript
  async addExpirationJob(
    bookingId: string,
    expiresAt?: Date | null,
  ): Promise<void> {
    const delay = expiresAt
      ? Math.max(expiresAt.getTime() - Date.now(), 0)
      : this.configService.get('PAYMENT_HOLD_MINUTES', 5) * 60000; // Mặc định 5 phút

    await this.bookingQueue.add(
      'expire-booking',
      { bookingId },
      {
        jobId: bookingId, // Thuộc tính Idempotent cho hàng đợi
        delay,            // Đưa vào Delayed Queue của Redis
      },
    );
  }
```

**Giải thích học thuật:** Hệ thống không dùng vòng lặp Cron để quét CSDL mỗi phút (gây lãng phí tài nguyên). Thay vào đó, sau khi tạo Booking thành công, một công việc (job) được đưa thẳng vào hàng đợi trì hoãn (Delayed Queue) của BullMQ (dựa trên Redis). Công việc này sẽ "ngủ" chính xác trong 5 phút trước khi tự động thức dậy.

### 2. Gọi hàm lập lịch ngay sau khi tạo Booking
**File:** `apps/api/src/booking/booking.service.ts`
**Hàm:** `createBookingOnce`

```typescript
    if (!isWalkIn) {
      // Phase 5: Hook into Booking Flow
      await this.bookingExpirationService.addExpirationJob(
        booking.id,
        booking.expiresAt,
      );
    }
```

### 3. Xử lý logic Hủy và Giải phóng sân an toàn
**File:** `apps/api/src/queues/booking-expiration/booking-expiration.processor.ts`
**Hàm:** `process` (trong Processor)

```typescript
          // Đọc lại trạng thái mới nhất bên trong transaction để tránh ghi đè sai
          const currentBooking = await tx.booking.findUnique({
            where: { id: bookingId },
            select: {
              status: true,
              version: true,
              bookingSlots: { select: { venueSlot: { select: { id: true, status: true } } } },
              payment: { select: { status: true } },
            },
          });

          // Bỏ qua việc huỷ nếu booking không còn trạng thái PENDING
          if (currentBooking.status !== 'PENDING') {
            return { action: 'skipped', reason: `booking status is ${currentBooking.status}` };
          }

          // Bỏ qua nếu đã thanh toán (có thể Webhook thanh toán đến cùng lúc với Timeout)
          if (currentBooking.payment?.status === PaymentStatus.PAID) {
            return { action: 'skipped', reason: 'booking already has a PAID payment' };
          }

          // 1. Cập nhật Booking thành CANCELLED
          const bookingUpdate = await tx.booking.updateMany({
            where: {
              id: bookingId,
              version: currentBooking.version, // Bảo vệ bằng Optimistic Locking
              status: 'PENDING',
            },
            data: {
              status: 'CANCELLED',
              cancelledAt: new Date(),
              cancelReason: 'AUTO_EXPIRED',
              version: { increment: 1 },
            },
          });

          // 2. Giải phóng slot từ LOCKED trở về AVAILABLE
          for (const bs of currentBooking.bookingSlots) {
            if (bs.venueSlot.status !== 'LOCKED') continue;

            await tx.venueSlot.updateMany({
              where: {
                id: bs.venueSlot.id,
                status: 'LOCKED',
              },
              data: { status: 'AVAILABLE', version: { increment: 1 } },
            });
          }
```

**Giải thích học thuật:** 
- Khi job hết thời gian `delay` và được kích hoạt, Processor sẽ bắt đầu một Transaction mới.
- Quá trình này được thiết kế để chịu lỗi cạnh tranh (Race Condition Tolerant): Do độ trễ mạng, Webhook xác nhận thanh toán từ MoMo có thể về tới máy chủ chính xác cùng phần nghìn giây với lúc Processor xử lý timeout. 
- Lệnh `tx.booking.updateMany` với điều kiện `version` và `status='PENDING'` đảm bảo rằng nếu Webhook đã xử lý xong trước đó 1 mili-giây, lệnh huỷ này sẽ không làm thay đổi trạng thái (trả về count = 0), tránh việc khách đã trả tiền mà hệ thống lại hủy sân.
**Quy tắc nghiệp vụ được chứng minh:** Tự động thu hồi và giải phóng tài nguyên (khung giờ) sau 5 phút, đồng thời đảm bảo không xảy ra xung đột khi khách hàng thanh toán vào đúng giây cuối cùng.
**Lưu ý kỹ thuật:** Kiến trúc dựa trên Hàng đợi độ trễ (Delayed Queue) có tính mở rộng (Scalability) cao hơn rất nhiều so với kỹ thuật Database Polling truyền thống.

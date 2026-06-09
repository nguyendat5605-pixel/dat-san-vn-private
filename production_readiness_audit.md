# Production-Readiness Audit: DatSanVN

This document details the production-readiness audit for the **DatSanVN** platform. The issues are classified into **Critical**, **High**, **Medium**, and **Low** severities, with explanations of root causes, real-world failure scenarios, and suggested code fixes.

---

## 1. Critical Issues

### 1.1 MIME Spoofing & Extension Preservation (Stored XSS / Session Hijacking)
* **Category:** Security Vulnerability
* **Root Cause:** 
  1. In [upload.controller.ts](file:///d:/Code_Ca_Nhan/dat-san-vn/apps/api/src/upload/upload.controller.ts), the file type is validated solely by checking `file.mimetype` (which is sent directly from the client in the `Content-Type` header and can be spoofed).
  2. The naming function uses `extname(file.originalname)` to write files to disk, preserving the original client-provided extension.
  3. The directory is served statically with `ServeStaticModule` at `/uploads/*`.
* **Real-World Failure Scenario:** An attacker uploads a malicious file named `xss.html` or `exploit.svg` containing arbitrary JavaScript, setting the upload request `Content-Type` to `image/jpeg`. The backend bypasses validation and saves it as `/uploads/1745678900-123456.html`. The attacker then gets a victim to open `http://localhost:3000/uploads/1745678900-123456.html`. Since the page is served under the API domain, the script runs, accesses cookie storage, and hijacks Clerk authentication session tokens.
* **Suggested Cleanest Fix:**
  1. Validate the file signature (magic bytes) using a library like `file-type`.
  2. Instead of preserving the original extension, enforce matching the extension to the validated magic bytes mime type.
  3. Configure the HTTP server (or NestJS static options) to serve files in the upload folder with the header `Content-Security-Policy: default-src 'none';` or `X-Content-Type-Options: nosniff` to prevent browser execution of scripts in HTML/SVG uploads.

### 1.2 Webhook Silent Drop on Database Failures (Unsynced Blocking Accounts)
* **Category:** Idempotency & Fault Recovery
* **Root Cause:** In [clerk-webhook.controller.ts](file:///d:/Code_Ca_Nhan/dat-san-vn/apps/api/src/webhooks/clerk/clerk-webhook.controller.ts), the `handleWebhook` method catches all exceptions from event processing (such as database deadlocks or network timeout) and returns a `200 OK` response with `received: true`.
* **Real-World Failure Scenario:** A new user registers via Clerk, triggering a `user.created` webhook. At that exact moment, the Supabase database experiences a transient pool connection spike and rejects the transaction. The API logs the database connection error, but still returns `200 OK` to Clerk. Clerk marks the webhook as successfully delivered. The user is never synced to the local PostgreSQL database. When the user loads the app, `ClerkAuthGuard` fails to find them, blocking them with the error *"User not found. Please wait for account sync."* because Clerk will never retry the webhook.
* **Suggested Cleanest Fix:** Diffrentiate between **verification errors** (bad signatures should return `400 Bad Request` or `200 OK` to discard) and **transient processing errors** (database connection failures, network timeouts). For transient errors, return a `500 Internal Server Error` or `503 Service Unavailable`, allowing Clerk's webhook system to execute its exponential backoff retry policy (5 retries over several hours) until the database is back online.

---

## 2. High Issues

### 2.1 Connection Pool Leak in Prisma Service (Database Connection Exhaustion)
* **Category:** Scalability Bottleneck / Resource Leak
* **Root Cause:** In [prisma.service.ts](file:///d:/Code_Ca_Nhan/dat-san-vn/apps/api/src/prisma/prisma.service.ts), the constructor attempts to implement global caching:
  ```typescript
  if (!globalForPrisma.__prisma) {
    globalForPrisma.__prisma = createPrismaClient();
  }
  // ...
  super({ adapter }); // <-- ALWAYS instantiates a new database pool!
  ```
  Calling `super({ adapter })` in NestJS constructor always instantiates a new PrismaClient connection pool regardless of what is stored in `globalForPrisma.__prisma`.
* **Real-World Failure Scenario:** In development, hot-reloading code instantiates `PrismaService` repeatedly. In production, under serverless environments (Vercel) or autoscaling container replicas, each spin-up instantiates a new `PrismaService` which opens a connection pool (10 connections by default in `pg`). Because the global cache check is bypassed in the `super` constructor call, old connections hang until they timeout, rapidly hitting Supabase/Neon connection limits (typically 50-100 connections max) and causing all subsequent API requests to fail with database connection timeouts.
* **Suggested Cleanest Fix:**
  Use a factory provider in `PrismaModule` to yield a single cached `PrismaClient` instance:
  ```typescript
  // prisma.module.ts
  export const prismaProvider = {
    provide: PrismaService,
    useFactory: () => {
      if (!globalForPrisma.__prisma) {
        globalForPrisma.__prisma = createPrismaClient();
      }
      return globalForPrisma.__prisma;
    }
  };
  ```
  Also, explicitly configure the connection limit in the database URL (e.g. `DATABASE_URL="postgres://...?connection_limit=3"`) if deploying on serverless architectures.

### 2.2 Concurrency Conflict logs treated as System Failures in BullMQ Expiration Queue
* **Category:** Concurrency Edge Case / Observability
* **Root Cause:** In [booking-expiration.processor.ts](file:///d:/Code_Ca_Nhan/dat-san-vn/apps/api/src/queues/booking-expiration/booking-expiration.processor.ts), the expiration logic wraps updates inside `withOptimisticLock` and `assertOptimisticUpdate`. If a conflict occurs (e.g., booking is confirmed concurrently), it throws a `BadRequestException` (HTTP 400), which exits the processor with an unhandled throw.
* **Real-World Failure Scenario:** A booking expiration job fires at the same time an owner is confirming a booking. The confirmation succeeds. The expiration job transaction fails its update assertion count (`0`) and throws a `BadRequestException`. BullMQ marks the job as failed, logs a full error stack trace in the server console, and triggers a retry. The retry is clean, but the logs are flooded with fake "system errors" which distort APM error rates.
* **Suggested Cleanest Fix:**
  Do not throw validation exceptions inside background processors for expected concurrency collisons. Catch `BadRequestException` specifically in the processor, check if the booking status is no longer `PENDING`, and if so, gracefully complete the job with a log message instead of bubbling the error.

---

## 3. Medium Issues

### 3.1 Missing Implementation for Walk-in Booking (`isWalkIn`)
* **Category:** Logical Incompleteness
* **Root Cause:** In [booking.controller.ts](file:///d:/Code_Ca_Nhan/dat-san-vn/apps/api/src/booking/booking.controller.ts), the route `POST /bookings/walk-in` forwards `isWalkIn: true` inside the DTO, but the service method `BookingService.createBooking` does not check this property at all. It treats the booking as a standard online pending reservation.
* **Real-World Failure Scenario:** A staff member registers a walk-in player at the venue and selects "Create Walk-in". The API creates the booking with status `PENDING` instead of `CONFIRMED` and schedules a 5-minute BullMQ expiration job. Because walk-ins are paid in cash immediately, there is no online payment, and the booking remains pending. After 5 minutes, the queue job triggers and cancels the booking automatically, freeing the slot for online players and causing overlapping bookings.
* **Suggested Cleanest Fix:**
  In `createBooking`, inspect `dto.isWalkIn`. If true:
  1. Create the booking with `status: 'CONFIRMED'`.
  2. Set the `VenueSlot` status to `BOOKED` directly.
  3. Create an associated `Payment` record with status `PAID` and method `CASH`.
  4. Skip adding the expiration job to the BullMQ scheduler.

### 3.2 Timezone-Blind Shift Revenue Queries
* **Category:** Database Query / Business Logic
* **Root Cause:** In [staff.service.ts](file:///d:/Code_Ca_Nhan/dat-san-vn/apps/api/src/staff/staff.service.ts), `getShiftRevenue` instantiates `new Date()`, sets hours to `0, 0, 0, 0` and queries bookings between `today` and `tomorrow`.
* **Real-World Failure Scenario:** The server runs in UTC (GMT+0) on Vercel. A venue manager in Vietnam (GMT+7) requests their daily shift revenue at 8:00 AM local time. The server calculates the day boundaries relative to UTC (越南 8:00 AM = UTC 1:00 AM). The query boundary filters bookings from UTC 00:00 to 24:00 (which corresponds to 7:00 AM today to 7:00 AM tomorrow in Vietnam), cutting off the first hour of bookings from the morning shift and including early morning bookings from the next day.
* **Suggested Cleanest Fix:**
  Require the client to send a timezone header/offset, or parse the venue's city/timezone configuration. Adjust the `gte` and `lt` boundaries in PostgreSQL using an offset calculator (e.g. using `moment-timezone` or native JS date offsetting relative to `Asia/Ho_Chi_Minh` time).

### 3.3 Broken Object Level Authorization (BOLA) Gap for Pending Owners
* **Category:** Security / Authorization
* **Root Cause:** `FieldService` and `VenueService` mutations use `validateManagementAccess` to check if a user is an owner. It only blocks ownership if status is `REJECTED`, letting `PENDING` owners modify fields and venues:
  ```typescript
  if (!ownership || ownership.status === 'REJECTED') {
    throw new ForbiddenException('You do not have permission...');
  }
  ```
* **Real-World Failure Scenario:** A user registers, claims ownership of an existing premium venue, and enters the `PENDING` owner verification queue. Before the administrator has reviewed or approved their claim, the user calls `PATCH /venues/:id` and `DELETE /fields/:id`, changing the price or deactivating slots.
* **Suggested Cleanest Fix:**
  Ensure that write/mutation operations (such as updates, deletions, and creating sub-fields) are blocked unless the ownership status is explicitly `APPROVED`. Use `validateOwnership` instead of `validateManagementAccess` for all write routes.

---

## 4. Low Issues

### 4.1 Lack of Idempotency on Booking Creation (Double Click Slot Locking)
* **Category:** API Reliability
* **Root Cause:** The `POST /bookings` endpoint does not implement idempotency key verification.
* **Real-World Failure Scenario:** A player with a slow mobile connection clicks "Xác nhận đặt sân" twice. The browser sends two identical POST requests. The first request locks the slot and creates the booking. The second request executes concurrently, sees the slot is now `LOCKED`, and returns a `400 Bad Request` error. The UI displays an error modal to the player, leading them to believe the reservation failed, even though the first request succeeded.
* **Suggested Cleanest Fix:**
  Implement a temporary Redis deduplication filter (e.g., hashing `userId + fieldId + timeSlotId`) that locks the request parameters for 3 seconds. If a duplicate request is received, return the cached successful response of the first transaction.

### 4.2 Query Aggregation in Application Memory
* **Category:** Performance / Database
* **Root Cause:** In `getShiftRevenue`, booking `totalPrice` sum calculations are performed by fetching all matching rows and calling `bookings.reduce(...)` in JavaScript.
* **Real-World Failure Scenario:** For popular venues processing hundreds of daily walk-ins and reservations, fetching full booking entities with nested payment objects solely to calculate a sum places unnecessary memory allocation pressure on the Node process and increases database network payload sizes.
* **Suggested Cleanest Fix:**
  Use Prisma's native `this.prisma.booking.aggregate({ _sum: { totalPrice: true }, where: { ... } })` to perform the mathematical operations in PostgreSQL.

# Payment Finalization Notes

## Current audited flow

Evidence inspected:

- `apps/api/src/payment/payment.controller.ts`
- `apps/api/src/payment/payment.service.ts`
- `apps/api/src/payment/payment.config.ts`
- `apps/api/src/payment/providers/mock-payment.provider.ts`
- `apps/api/src/payment/providers/momo-payment.provider.ts`
- `apps/api/src/payment/providers/vnpay-payment.provider.ts`
- `apps/api/prisma/schema.prisma`
- `apps/web/components/booking/booking-sheet.tsx`
- `apps/web/app/(main)/payments/return/page.tsx`
- `apps/web/lib/player-payment-api.ts`
- `apps/web/lib/player-booking-api.ts`

The booking flow creates a `PENDING` booking and changes the selected `VenueSlot` from `AVAILABLE` to `LOCKED`. Booking expiration remains 5 minutes by default through `PAYMENT_HOLD_MINUTES` fallback in `BookingExpirationService`.

Payment initiation is implemented through `POST /api/payments`. It creates or reuses a `Payment`, creates a `PaymentAttempt`, calls the selected provider through `PaymentProviderRegistry`, stores the returned `paymentUrl`, and returns the payment attempt details to the frontend.

## Demo-safe local mock completion

Added endpoint:

```http
POST /api/payments/mock/:attemptId/complete
Authorization: Bearer <Clerk token>
```

This endpoint is for local/demo use only:

- It is disabled when `NODE_ENV=production`.
- It also requires mock payment completion to be enabled through `ENABLE_MOCK_PAYMENT=true`, or by the default development behavior when `PAYMENT_MOCK_PROVIDER_ENABLED` is unset.
- It only completes attempts created by the local mock provider, detected by `rawCreateResponse.mock === true` or the mock return URL marker.
- It is idempotent. If the attempt/payment/booking/slot are already finalized, it returns `finalizationStatus: "already_finalized"` without mutating data again.

Successful completion reuses the same shared guarded finalization helper used by MoMo webhook success. It marks:

- `PaymentAttempt.status = PAID`
- `Payment.status = PAID`
- `Booking.status = CONFIRMED`
- related `VenueSlot.status = BOOKED`

Cancelled, expired, failed, non-mock, or otherwise unsafe attempts are rejected and are not mutated.

Example success response:

```json
{
  "statusCode": 200,
  "message": "Mock payment completed successfully",
  "data": {
    "attemptId": "...",
    "paymentId": "...",
    "bookingId": "...",
    "provider": "MOMO",
    "finalizationStatus": "finalized"
  }
}
```

## Frontend demo flow

1. Player creates a booking from `BookingSheet`.
2. Frontend calls `POST /api/payments` with provider `MOMO`.
3. If MoMo sandbox is disabled and mock provider is enabled, the backend returns a local mock `paymentUrl`.
4. Frontend redirects to `/payments/return?bookingId=...&mockPayment=true&attemptId=...`.
5. In development only, the return page shows `Simulate successful payment`.
6. Clicking it calls `POST /api/payments/mock/:attemptId/complete`.
7. The return page polls `GET /api/payments/booking/:bookingId/status` and shows success once `Payment=PAID` and `Booking=CONFIRMED`.

## MoMo sandbox sanity

MoMo sandbox remains prototype/sandbox, not production payment.

Required env names for sandbox:

- `MOMO_SANDBOX_ENABLED=true`
- `MOMO_SANDBOX_ENDPOINT`
- `MOMO_PARTNER_CODE`
- `MOMO_ACCESS_KEY`
- `MOMO_SECRET_KEY`
- optional `MOMO_SANDBOX_TIMEOUT_MS`
- `PAYMENT_RETURN_BASE_URL` or `FRONTEND_URL`
- `PAYMENT_WEBHOOK_BASE_URL`

The MoMo provider already gives clear missing-config errors and verifies IPN signatures before finalizing payment state. A valid MoMo IPN still transitions the payment through the shared guarded finalization helper.

## VNPay scope

VNPay remains planned/prototype for this submission. The current provider can create a sandbox-style URL, but `verifyWebhook()` explicitly throws `NotImplementedException`, and the payment controller only processes MoMo webhooks. Do not present VNPay production webhook/payment completion as finished.

## Suggested local env for mock demo

```env
NODE_ENV=development
PAYMENT_MOCK_PROVIDER_ENABLED=true
ENABLE_MOCK_PAYMENT=true
MOMO_SANDBOX_ENABLED=false
PAYMENT_RETURN_BASE_URL=http://localhost:3001
PAYMENT_WEBHOOK_BASE_URL=http://localhost:3000/api
```

No real payment secrets are required for the local mock path.

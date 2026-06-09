-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('MOMO', 'VNPAY');

-- CreateEnum
CREATE TYPE "PaymentAttemptStatus" AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED', 'REQUIRES_RECONCILIATION');

-- CreateEnum
CREATE TYPE "PaymentWebhookProcessingStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'DUPLICATE', 'IGNORED', 'INVALID_SIGNATURE', 'AMOUNT_MISMATCH', 'FAILED');

-- AlterTable
ALTER TABLE "payments"
ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'VND',
ADD COLUMN "provider" "PaymentProvider",
ADD COLUMN "failed_at" TIMESTAMP(3),
ADD COLUMN "expires_at" TIMESTAMP(3),
ADD COLUMN "failure_code" TEXT,
ADD COLUMN "failure_message" TEXT,
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "payment_attempts" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "idempotency_key" TEXT,
    "provider_order_id" TEXT NOT NULL,
    "provider_request_id" TEXT,
    "provider_transaction_id" TEXT,
    "payment_url" TEXT,
    "expires_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "failure_code" TEXT,
    "failure_message" TEXT,
    "raw_create_response" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_webhook_events" (
    "id" TEXT NOT NULL,
    "attempt_id" TEXT,
    "provider" "PaymentProvider" NOT NULL,
    "provider_order_id" TEXT,
    "provider_transaction_id" TEXT,
    "provider_event_id" TEXT,
    "payload_hash" TEXT NOT NULL,
    "signature_verified" BOOLEAN NOT NULL DEFAULT false,
    "processing_status" "PaymentWebhookProcessingStatus" NOT NULL DEFAULT 'RECEIVED',
    "raw_payload" JSONB NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payments_provider_status_idx" ON "payments"("provider", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payment_attempts_provider_order_id_key" ON "payment_attempts"("provider_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_attempts_provider_request_id_key" ON "payment_attempts"("provider_request_id");

-- CreateIndex
CREATE INDEX "payment_attempts_payment_id_status_idx" ON "payment_attempts"("payment_id", "status");

-- CreateIndex
CREATE INDEX "payment_attempts_provider_provider_transaction_id_idx" ON "payment_attempts"("provider", "provider_transaction_id");

-- CreateIndex
CREATE INDEX "payment_attempts_expires_at_idx" ON "payment_attempts"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "payment_webhook_events_payload_hash_key" ON "payment_webhook_events"("payload_hash");

-- CreateIndex
CREATE INDEX "payment_webhook_events_provider_provider_order_id_idx" ON "payment_webhook_events"("provider", "provider_order_id");

-- CreateIndex
CREATE INDEX "payment_webhook_events_provider_provider_transaction_id_idx" ON "payment_webhook_events"("provider", "provider_transaction_id");

-- CreateIndex
CREATE INDEX "payment_webhook_events_processing_status_idx" ON "payment_webhook_events"("processing_status");

-- AddForeignKey
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_webhook_events" ADD CONSTRAINT "payment_webhook_events_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "payment_attempts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

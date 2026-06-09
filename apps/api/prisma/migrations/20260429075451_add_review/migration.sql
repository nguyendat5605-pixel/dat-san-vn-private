-- DropIndex
DROP INDEX "reviews_rating_idx";

-- DropIndex
DROP INDEX "reviews_user_id_venue_id_key";

-- AlterTable
ALTER TABLE "reviews" ADD COLUMN     "booking_id" TEXT,
ALTER COLUMN "rating" SET DEFAULT 5;

-- AlterTable
ALTER TABLE "venues" ADD COLUMN     "avg_rating" DECIMAL(3,2) DEFAULT 0,
ADD COLUMN     "rating" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ADD COLUMN     "review_count" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "reviews_user_id_idx" ON "reviews"("user_id");

-- CreateIndex
CREATE INDEX "reviews_booking_id_idx" ON "reviews"("booking_id");

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

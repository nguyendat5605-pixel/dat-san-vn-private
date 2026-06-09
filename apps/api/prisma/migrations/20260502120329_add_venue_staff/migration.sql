-- CreateEnum
CREATE TYPE "StaffPermission" AS ENUM ('MANAGE_BOOKINGS', 'CREATE_WALK_IN', 'PROCESS_PAYMENT', 'VIEW_SHIFT_REVENUE');

-- CreateTable
CREATE TABLE "venue_staff" (
    "id" TEXT NOT NULL,
    "venue_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "permissions" "StaffPermission"[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "invited_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "venue_staff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "venue_staff_venue_id_idx" ON "venue_staff"("venue_id");

-- CreateIndex
CREATE INDEX "venue_staff_user_id_idx" ON "venue_staff"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "venue_staff_venue_id_user_id_key" ON "venue_staff"("venue_id", "user_id");

-- AddForeignKey
ALTER TABLE "venue_staff" ADD CONSTRAINT "venue_staff_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_staff" ADD CONSTRAINT "venue_staff_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_staff" ADD CONSTRAINT "venue_staff_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

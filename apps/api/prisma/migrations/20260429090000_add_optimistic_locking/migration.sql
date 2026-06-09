-- Add version columns used by optimistic locking guards.
ALTER TABLE "bookings" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "fields" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "venues" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "venue_slots" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

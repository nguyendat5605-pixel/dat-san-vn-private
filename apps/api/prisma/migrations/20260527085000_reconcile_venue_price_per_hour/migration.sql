-- Reconcile migration history with the intended Venue schema.
-- Some existing databases already have this column, so keep this forward-only
-- and idempotent to preserve venue data.
ALTER TABLE "venues"
ADD COLUMN IF NOT EXISTS "price_per_hour" DECIMAL(12,0);

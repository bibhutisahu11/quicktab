-- Add per-customer meal enable flags to regular_customers
ALTER TABLE "regular_customers" ADD COLUMN "enableBreakfast" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "regular_customers" ADD COLUMN "enableLunch"     BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "regular_customers" ADD COLUMN "enableDinner"    BOOLEAN NOT NULL DEFAULT true;

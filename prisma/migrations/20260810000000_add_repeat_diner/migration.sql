-- Add isRepeatDiner flag to orders
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "isRepeatDiner" BOOLEAN NOT NULL DEFAULT false;

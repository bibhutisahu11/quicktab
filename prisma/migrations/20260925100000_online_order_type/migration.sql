-- Add ONLINE to OrderType enum
ALTER TYPE "OrderType" ADD VALUE IF NOT EXISTS 'ONLINE';
-- Add onlinePlatform to orders table
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "onlinePlatform" TEXT;

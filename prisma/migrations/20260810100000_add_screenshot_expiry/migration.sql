-- Add screenshotExpiry field to store when the payment screenshot should be purged (2 days after order)
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "screenshotExpiry" TIMESTAMP(3);

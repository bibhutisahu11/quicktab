-- Add partyType column to advance_payments (Customer | Staff)
ALTER TABLE "advance_payments"
  ADD COLUMN IF NOT EXISTS "partyType" TEXT NOT NULL DEFAULT 'Customer';

CREATE TABLE "advance_payments" (
  "id"           TEXT         NOT NULL,
  "orgId"        TEXT         NOT NULL,
  "customerName" TEXT         NOT NULL,
  "phone"        TEXT,
  "amount"       DOUBLE PRECISION NOT NULL,
  "paymentMode"  TEXT         NOT NULL DEFAULT 'Cash',
  "purpose"      TEXT,
  "date"         TEXT         NOT NULL,
  "receivedBy"   TEXT,
  "settled"      BOOLEAN      NOT NULL DEFAULT false,
  "settledOn"    TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "advance_payments_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "advance_payments"
  ADD CONSTRAINT "advance_payments_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "advance_payments_orgId_idx"      ON "advance_payments"("orgId");
CREATE INDEX "advance_payments_orgId_date_idx" ON "advance_payments"("orgId", "date");

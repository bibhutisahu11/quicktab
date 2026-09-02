CREATE TYPE "CreditEntryType" AS ENUM ('BILL', 'PAYMENT');

CREATE TABLE "credit_customers" (
    "id"        TEXT NOT NULL,
    "orgId"     TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "phone"     TEXT,
    "address"   TEXT,
    "notes"     TEXT,
    "active"    BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "credit_customers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "credit_entries" (
    "id"          TEXT NOT NULL,
    "orgId"       TEXT NOT NULL,
    "customerId"  TEXT NOT NULL,
    "type"        "CreditEntryType" NOT NULL,
    "amount"      DOUBLE PRECISION NOT NULL,
    "items"       JSONB,
    "description" TEXT,
    "date"        TEXT NOT NULL,
    "notes"       TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "credit_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "credit_customers_orgId_idx" ON "credit_customers"("orgId");
CREATE INDEX "credit_entries_orgId_idx" ON "credit_entries"("orgId");
CREATE INDEX "credit_entries_customerId_idx" ON "credit_entries"("customerId");
CREATE INDEX "credit_entries_orgId_date_idx" ON "credit_entries"("orgId", "date");

ALTER TABLE "credit_customers"
    ADD CONSTRAINT "credit_customers_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "credit_entries"
    ADD CONSTRAINT "credit_entries_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "credit_entries"
    ADD CONSTRAINT "credit_entries_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "credit_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

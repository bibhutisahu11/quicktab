CREATE TABLE "cash_drawers" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "openingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cash_drawers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "cash_drawers_orgId_date_key" ON "cash_drawers"("orgId", "date");
CREATE INDEX "cash_drawers_orgId_idx" ON "cash_drawers"("orgId");
ALTER TABLE "cash_drawers" ADD CONSTRAINT "cash_drawers_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

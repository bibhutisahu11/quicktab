CREATE TABLE "meal_payments" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "paidOn" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meal_payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "meal_payments_customerId_month_key" ON "meal_payments"("customerId", "month");
CREATE INDEX "meal_payments_orgId_idx" ON "meal_payments"("orgId");
CREATE INDEX "meal_payments_orgId_month_idx" ON "meal_payments"("orgId", "month");

ALTER TABLE "meal_payments" ADD CONSTRAINT "meal_payments_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "meal_payments" ADD CONSTRAINT "meal_payments_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "regular_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

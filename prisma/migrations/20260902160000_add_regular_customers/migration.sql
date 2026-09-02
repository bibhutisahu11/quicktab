-- CreateTable: regular_customers
CREATE TABLE "regular_customers" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "rateBreakfast" DOUBLE PRECISION,
    "rateLunch" DOUBLE PRECISION,
    "rateDinner" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regular_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable: meal_entries
CREATE TABLE "meal_entries" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "breakfast" BOOLEAN NOT NULL DEFAULT false,
    "lunch" BOOLEAN NOT NULL DEFAULT false,
    "dinner" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "regular_customers_orgId_idx" ON "regular_customers"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "meal_entries_customerId_date_key" ON "meal_entries"("customerId", "date");

-- CreateIndex
CREATE INDEX "meal_entries_orgId_idx" ON "meal_entries"("orgId");

-- CreateIndex
CREATE INDEX "meal_entries_orgId_date_idx" ON "meal_entries"("orgId", "date");

-- CreateIndex
CREATE INDEX "meal_entries_customerId_idx" ON "meal_entries"("customerId");

-- AddForeignKey
ALTER TABLE "regular_customers" ADD CONSTRAINT "regular_customers_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_entries" ADD CONSTRAINT "meal_entries_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "regular_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

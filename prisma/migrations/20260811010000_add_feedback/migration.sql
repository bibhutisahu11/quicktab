CREATE TABLE IF NOT EXISTS "feedbacks" (
  "id"           TEXT NOT NULL,
  "orgId"        TEXT NOT NULL,
  "orderId"      TEXT,
  "rating"       INTEGER NOT NULL,
  "experience"   TEXT,
  "improvement"  TEXT,
  "customerName" TEXT,
  "phone"        TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "feedbacks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "feedbacks_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

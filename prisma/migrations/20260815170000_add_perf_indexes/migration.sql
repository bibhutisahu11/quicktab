-- Performance indexes for orders, order_items, and menu_items

CREATE INDEX CONCURRENTLY IF NOT EXISTS "orders_orgId_idx" ON "orders"("orgId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "orders_orgId_status_idx" ON "orders"("orgId", "status");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "orders_orgId_createdAt_idx" ON "orders"("orgId", "createdAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "order_items_orderId_idx" ON "order_items"("orderId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "menu_items_orgId_idx" ON "menu_items"("orgId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "menu_items_orgId_available_idx" ON "menu_items"("orgId", "available");

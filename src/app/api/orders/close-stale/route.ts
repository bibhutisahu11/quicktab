import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/orgGuard";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/orders/close-stale
 *
 * Finds all PAYMENT_PENDING / PENDING / PREPARING orders created
 * before today (local midnight IST) and marks them CANCELLED.
 * Called silently from the admin dashboard on each day-start.
 */
export async function POST(req: NextRequest) {
  const ctx = await getOrgContext(req, {
    requireRoles: ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER", "BILLER"],
  });
  if (ctx.error) return ctx.error;

  // Midnight of today in IST (UTC+5:30)
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const todayIST = new Date(now.getTime() + istOffset);
  todayIST.setUTCHours(0, 0, 0, 0);
  const midnightUTC = new Date(todayIST.getTime() - istOffset);

  const OPEN_STATUSES = ["PAYMENT_PENDING", "PENDING", "PREPARING"] as const;

  const result = await prisma.order.updateMany({
    where: {
      orgId: ctx.orgId!,
      status: { in: OPEN_STATUSES as unknown as never[] },
      createdAt: { lt: midnightUTC },
    },
    data: {
      status: "CANCELLED",
    },
  });

  return NextResponse.json({ closed: result.count });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Public endpoint — no auth required.
 * GET /api/public/check-dining?phone=9876543210&orgSlug=kalinga-bites
 *
 * Returns { isDining: true/false, orderCount, latestOrder? }
 * "Dining" = has an active (non-DONE, non-CANCELLED) order in the last 90 minutes.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const phone   = searchParams.get("phone")?.trim();
  const orgSlug = searchParams.get("orgSlug")?.trim();

  if (!phone || !orgSlug) {
    return NextResponse.json({ isDining: false });
  }

  try {
    const org = await prisma.organization.findUnique({
      where: { slug: orgSlug },
      select: { id: true },
    });
    if (!org) return NextResponse.json({ isDining: false });

    const since = new Date(Date.now() - 90 * 60 * 1000);
    const activeStatuses = ["PENDING", "PAYMENT_PENDING", "PREPARING", "READY"];

    const activeOrders = await prisma.order.findMany({
      where: {
        orgId: org.id,
        phone,
        status: { in: activeStatuses as never[] },
        createdAt: { gte: since },
      },
      select: {
        id: true,
        customerName: true,
        status: true,
        createdAt: true,
        table: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      isDining: activeOrders.length > 0,
      orderCount: activeOrders.length,
      latestOrder: activeOrders[0] ?? null,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ isDining: false });
  }
}

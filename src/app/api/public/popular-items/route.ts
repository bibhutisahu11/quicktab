import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/public/popular-items?orgSlug=kalinga-bites&limit=20
 *
 * Returns menu items with their total order counts (all time).
 * Used to show social proof badges on the menu ("🔥 142 orders").
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orgSlug = searchParams.get("orgSlug")?.trim();
  const limit   = Math.min(Number(searchParams.get("limit") ?? "50"), 100);

  if (!orgSlug) return NextResponse.json([]);

  try {
    const org = await prisma.organization.findUnique({
      where: { slug: orgSlug },
      select: { id: true },
    });
    if (!org) return NextResponse.json([]);

    // Aggregate order item counts per menuItemId for this org
    const raw = await prisma.orderItem.groupBy({
      by: ["menuItemId", "name"],
      where: {
        order: {
          orgId: org.id,
          status: { notIn: ["CANCELLED"] },
        },
        menuItemId: { not: null },
      },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: limit,
    });

    const result = raw.map((r) => ({
      menuItemId: r.menuItemId,
      name: r.name,
      totalOrdered: r._sum.quantity ?? 0,
    }));

    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json([]);
  }
}

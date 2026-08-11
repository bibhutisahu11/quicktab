import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/orgGuard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ctx = await getOrgContext(req, {
    requireRoles: ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER", "BILLER"],
  });
  if (ctx.error) return ctx.error;

  try {
    const { searchParams } = new URL(req.url);
    const limit  = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);
    const offset = parseInt(searchParams.get("offset") ?? "0");
    const minRating = parseInt(searchParams.get("minRating") ?? "1");

    const [feedbacks, total] = await Promise.all([
      prisma.feedback.findMany({
        where: { orgId: ctx.orgId!, rating: { gte: minRating } },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.feedback.count({
        where: { orgId: ctx.orgId! },
      }),
    ]);

    // Summary stats
    const allRatings = await prisma.feedback.findMany({
      where: { orgId: ctx.orgId! },
      select: { rating: true },
    });
    const avgRating = allRatings.length
      ? allRatings.reduce((s, f) => s + f.rating, 0) / allRatings.length
      : 0;
    const dist = [1, 2, 3, 4, 5].map((r) => ({
      rating: r,
      count: allRatings.filter((f) => f.rating === r).length,
    }));

    return NextResponse.json({ feedbacks, total, avgRating, dist });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch feedback" }, { status: 500 });
  }
}

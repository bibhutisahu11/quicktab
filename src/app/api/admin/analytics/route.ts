import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/orgGuard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Platform commission rates (% taken by the platform)
const COMMISSION: Record<string, number> = {
  Swiggy:     0.30,
  Zomato:     0.30,
  Toing:      0.05,
  Ownly:      0.00,
  "Magic Pin": 0.26,
};

export async function GET(req: NextRequest) {
  const ctx = await getOrgContext(req, {
    requireRoles: ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER"],
  });
  if (ctx.error) return ctx.error;

  try {
    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") ?? "month";

    const now = new Date();
    let since: Date;
    if (period === "day") {
      since = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === "week") {
      since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else {
      since = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const orgFilter = ctx.orgId ? { orgId: ctx.orgId } : {};

    const topItems = await prisma.orderItem.groupBy({
      by: ["name"],
      where: {
        order: {
          ...orgFilter,
          createdAt: { gte: since },
          status: { not: "CANCELLED" },
        },
      },
      _sum: { quantity: true },
      _count: { id: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 10,
    });

    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentOrders = await prisma.order.findMany({
      where: { ...orgFilter, createdAt: { gte: last30Days }, status: { not: "CANCELLED" } },
      select: { createdAt: true, total: true, type: true, onlinePlatform: true },
      orderBy: { createdAt: "asc" },
    });

    const revenueByDay: Record<string, { revenue: number; orders: number }> = {};
    // Online vs offline counters
    const channelStats = { online: { count: 0, revenue: 0 }, offline: { count: 0, revenue: 0 } };
    const platformStats: Record<string, { count: number; revenue: number }> = {};
    for (const order of recentOrders) {
      const key = order.createdAt.toISOString().slice(0, 10);
      if (!revenueByDay[key]) revenueByDay[key] = { revenue: 0, orders: 0 };
      revenueByDay[key].revenue += order.total;
      revenueByDay[key].orders += 1;
      // Channel breakdown
      if (order.type === "ONLINE") {
        channelStats.online.count++;
        channelStats.online.revenue += order.total;
        const plat = order.onlinePlatform ?? "Unknown";
        if (!platformStats[plat]) platformStats[plat] = { count: 0, revenue: 0 };
        platformStats[plat].count++;
        platformStats[plat].revenue += order.total;
      } else {
        channelStats.offline.count++;
        channelStats.offline.revenue += order.total;
      }
    }

    const last6Months = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const monthlyOrders = await prisma.order.findMany({
      where: { ...orgFilter, createdAt: { gte: last6Months }, status: { not: "CANCELLED" } },
      select: { createdAt: true, total: true },
      orderBy: { createdAt: "asc" },
    });

    const revenueByMonth: Record<string, { revenue: number; orders: number }> = {};
    for (const order of monthlyOrders) {
      const key = `${order.createdAt.getFullYear()}-${String(order.createdAt.getMonth() + 1).padStart(2, "0")}`;
      if (!revenueByMonth[key]) revenueByMonth[key] = { revenue: 0, orders: 0 };
      revenueByMonth[key].revenue += order.total;
      revenueByMonth[key].orders += 1;
    }

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const [todayStats, periodStats, totalStats] = await Promise.all([
      prisma.order.aggregate({
        where: { ...orgFilter, createdAt: { gte: todayStart }, status: { not: "CANCELLED" } },
        _sum: { total: true },
        _count: { id: true },
      }),
      prisma.order.aggregate({
        where: { ...orgFilter, createdAt: { gte: since }, status: { not: "CANCELLED" } },
        _sum: { total: true },
        _count: { id: true },
      }),
      prisma.order.aggregate({
        where: { ...orgFilter, status: { not: "CANCELLED" } },
        _sum: { total: true },
        _count: { id: true },
      }),
    ]);

    // ── Monthly P&L (current month) ────────────────────────────────────────────
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthOrders = await prisma.order.findMany({
      where: { ...orgFilter, createdAt: { gte: monthStart }, status: { not: "CANCELLED" } },
      select: { total: true, type: true, onlinePlatform: true },
    });

    let grossRevenue = 0;
    let totalCommission = 0;
    const commissionByPlatform: Record<string, number> = {};
    for (const o of thisMonthOrders) {
      grossRevenue += o.total;
      if (o.type === "ONLINE") {
        const rate = COMMISSION[o.onlinePlatform ?? ""] ?? 0;
        const commission = o.total * rate;
        totalCommission += commission;
        const plat = o.onlinePlatform ?? "Unknown";
        commissionByPlatform[plat] = (commissionByPlatform[plat] ?? 0) + commission;
      }
    }
    const netRevenue = grossRevenue - totalCommission;

    const thisMonthExpenses = await prisma.expense.aggregate({
      where: { ...(ctx.orgId ? { orgId: ctx.orgId } : {}), date: { gte: monthStart } },
      _sum: { amount: true },
    });
    const totalExpenses = thisMonthExpenses._sum.amount ?? 0;
    const monthlyProfit = netRevenue - totalExpenses;

    return NextResponse.json({
      topItems: topItems.map((i) => ({
        name: i.name,
        quantity: i._sum.quantity ?? 0,
        orderCount: i._count.id,
      })),
      revenueByDay: Object.entries(revenueByDay).map(([date, data]) => ({ date, ...data })),
      revenueByMonth: Object.entries(revenueByMonth).map(([month, data]) => ({ month, ...data })),
      channelStats,
      platformStats: Object.entries(platformStats)
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.count - a.count),
      profitLoss: {
        grossRevenue,
        totalCommission,
        commissionByPlatform,
        netRevenue,
        totalExpenses,
        monthlyProfit,
        month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
      },
      summary: {
        todayRevenue: todayStats._sum.total ?? 0,
        todayOrders: todayStats._count.id,
        periodRevenue: periodStats._sum.total ?? 0,
        periodOrders: periodStats._count.id,
        totalRevenue: totalStats._sum.total ?? 0,
        totalOrders: totalStats._count.id,
      },
      period,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

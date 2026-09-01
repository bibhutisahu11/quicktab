import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/orgGuard";
import { prisma } from "@/lib/prisma";

function todayString() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

const ALLOWED_ROLES = ["BILLER", "HOTEL_ADMIN", "MANAGER", "SUPER_ADMIN"];

export async function GET(req: NextRequest) {
  const ctx = await getOrgContext(req, { requireRoles: ALLOWED_ROLES });
  if (ctx.error) return ctx.error;

  const date = new URL(req.url).searchParams.get("date") ?? todayString();

  try {
    const [drawer, cashAgg] = await Promise.all([
      ctx.orgId
        ? prisma.cashDrawer.findUnique({ where: { orgId_date: { orgId: ctx.orgId, date } } })
        : null,

      ctx.orgId
        ? prisma.order.aggregate({
            where: {
              orgId: ctx.orgId,
              paymentMethod: "CASH",
              status: { in: ["DONE", "READY", "PREPARING"] },
              createdAt: {
                gte: new Date(`${date}T00:00:00.000Z`),
                lt: new Date(`${date}T23:59:59.999Z`),
              },
            },
            _sum: { total: true },
          })
        : Promise.resolve({ _sum: { total: 0 } }),
    ]);

    return NextResponse.json({
      drawer,
      cashFromOrders: cashAgg._sum.total ?? 0,
      date,
    });
  } catch (err) {
    console.error("[cash-drawer GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const ctx = await getOrgContext(req, { requireRoles: ALLOWED_ROLES });
  if (ctx.error) return ctx.error;

  if (!ctx.orgId) {
    return NextResponse.json({ error: "No organisation associated with this account" }, { status: 400 });
  }

  try {
    const { openingBalance, notes, date } = await req.json() as {
      openingBalance?: number;
      notes?: string;
      date?: string;
    };

    const targetDate = date ?? todayString();

    // Check if already set today — opening balance is set-once per day
    const existing = await prisma.cashDrawer.findUnique({
      where: { orgId_date: { orgId: ctx.orgId, date: targetDate } },
    });
    if (existing) {
      return NextResponse.json({ error: "Opening balance already set for today. It cannot be changed." }, { status: 409 });
    }

    const drawer = await prisma.cashDrawer.create({
      data: {
        orgId: ctx.orgId,
        date: targetDate,
        openingBalance: openingBalance ?? 0,
        notes: notes ?? null,
      },
    });

    return NextResponse.json(drawer);
  } catch (err) {
    console.error("[cash-drawer POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

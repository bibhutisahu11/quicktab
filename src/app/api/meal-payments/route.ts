import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrgContext } from "@/lib/orgGuard";

// GET /api/meal-payments?month=YYYY-MM
export async function GET(req: NextRequest) {
  const ctx = await getOrgContext(req, {
    requireRoles: ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER", "BILLER"],
  });
  if (ctx.error) return ctx.error;

  const month = new URL(req.url).searchParams.get("month");

  const payments = await prisma.mealPayment.findMany({
    where: {
      orgId: ctx.orgId!,
      ...(month ? { month } : {}),
    },
    orderBy: { paidOn: "desc" },
  });

  return NextResponse.json(payments);
}

// POST /api/meal-payments — upsert payment for a customer+month
export async function POST(req: NextRequest) {
  const ctx = await getOrgContext(req, {
    requireRoles: ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER", "BILLER"],
  });
  if (ctx.error) return ctx.error;

  const { customerId, month, paidOn, amount, notes } = await req.json();

  if (!customerId || !month || !paidOn || amount == null) {
    return NextResponse.json({ error: "customerId, month, paidOn, amount required" }, { status: 400 });
  }

  const payment = await prisma.mealPayment.upsert({
    where: { customerId_month: { customerId, month } },
    create: {
      orgId: ctx.orgId!,
      customerId,
      month,
      paidOn,
      amount: parseFloat(amount),
      notes: notes || null,
    },
    update: {
      paidOn,
      amount: parseFloat(amount),
      notes: notes !== undefined ? (notes || null) : undefined,
    },
  });

  return NextResponse.json(payment, { status: 201 });
}

// DELETE /api/meal-payments?customerId=xxx&month=YYYY-MM  (unmark payment)
export async function DELETE(req: NextRequest) {
  const ctx = await getOrgContext(req, {
    requireRoles: ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER"],
  });
  if (ctx.error) return ctx.error;

  const { searchParams } = new URL(req.url);
  const customerId = searchParams.get("customerId");
  const month      = searchParams.get("month");

  if (!customerId || !month) {
    return NextResponse.json({ error: "customerId and month required" }, { status: 400 });
  }

  await prisma.mealPayment.deleteMany({
    where: { orgId: ctx.orgId!, customerId, month },
  });

  return NextResponse.json({ ok: true });
}

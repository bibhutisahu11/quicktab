import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrgContext } from "@/lib/orgGuard";

// GET /api/advance?month=2026-08  (defaults to current month)
export async function GET(req: NextRequest) {
  const ctx = await getOrgContext(req, {
    requireRoles: ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER", "BILLER"],
  });
  if (ctx.error) return ctx.error;

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month"); // YYYY-MM

  const advances = await prisma.advancePayment.findMany({
    where: {
      orgId: ctx.orgId!,
      ...(month ? { date: { gte: `${month}-01`, lte: `${month}-31` } } : {}),
    },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(advances);
}

// POST /api/advance
export async function POST(req: NextRequest) {
  const ctx = await getOrgContext(req, {
    requireRoles: ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER"],
  });
  if (ctx.error) return ctx.error;

  const body = await req.json();
  const { customerName, phone, amount, paymentMode, purpose, date, receivedBy, partyType, monthlySalary } = body;

  if (!customerName || !amount || !date) {
    return NextResponse.json({ error: "customerName, amount, date are required" }, { status: 400 });
  }

  const record = await prisma.advancePayment.create({
    data: {
      orgId: ctx.orgId!,
      partyType: partyType || "Customer",
      customerName,
      phone: phone || null,
      amount: parseFloat(amount),
      paymentMode: paymentMode || "Cash",
      purpose: purpose || null,
      date,
      receivedBy: receivedBy || null,
      monthlySalary: monthlySalary ? parseFloat(monthlySalary) : null,
    },
  });

  return NextResponse.json(record, { status: 201 });
}

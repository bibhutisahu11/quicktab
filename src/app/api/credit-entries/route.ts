import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrgContext } from "@/lib/orgGuard";

// GET /api/credit-entries?customerId=xxx
export async function GET(req: NextRequest) {
  const ctx = await getOrgContext(req, {
    requireRoles: ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER", "BILLER"],
  });
  if (ctx.error) return ctx.error;

  const customerId = new URL(req.url).searchParams.get("customerId");
  if (!customerId) return NextResponse.json({ error: "customerId required" }, { status: 400 });

  const entries = await prisma.creditEntry.findMany({
    where: { orgId: ctx.orgId!, customerId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(entries);
}

// POST /api/credit-entries  — add a BILL or PAYMENT
export async function POST(req: NextRequest) {
  const ctx = await getOrgContext(req, {
    requireRoles: ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER", "BILLER"],
  });
  if (ctx.error) return ctx.error;

  const { customerId, type, amount, items, description, date, notes } = await req.json();

  if (!customerId || !type || !amount || !date) {
    return NextResponse.json({ error: "customerId, type, amount, date required" }, { status: 400 });
  }
  if (!["BILL", "PAYMENT"].includes(type)) {
    return NextResponse.json({ error: "type must be BILL or PAYMENT" }, { status: 400 });
  }

  // Verify customer belongs to org
  const customer = await prisma.creditCustomer.findFirst({
    where: { id: customerId, orgId: ctx.orgId! },
  });
  if (!customer) return NextResponse.json({ error: "customer not found" }, { status: 404 });

  const entry = await prisma.creditEntry.create({
    data: {
      orgId: ctx.orgId!,
      customerId,
      type,
      amount: parseFloat(amount),
      items: items ?? null,
      description: description || null,
      date,
      notes: notes || null,
    },
  });

  return NextResponse.json(entry, { status: 201 });
}

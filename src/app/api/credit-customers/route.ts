import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrgContext } from "@/lib/orgGuard";

export async function GET(req: NextRequest) {
  const ctx = await getOrgContext(req, {
    requireRoles: ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER", "BILLER"],
  });
  if (ctx.error) return ctx.error;

  const customers = await prisma.creditCustomer.findMany({
    where: { orgId: ctx.orgId! },
    orderBy: { name: "asc" },
  });

  // Attach outstanding balance to each customer
  const entries = await prisma.creditEntry.findMany({
    where: { orgId: ctx.orgId! },
    select: { customerId: true, type: true, amount: true },
  });

  const balanceMap: Record<string, number> = {};
  for (const e of entries) {
    if (!balanceMap[e.customerId]) balanceMap[e.customerId] = 0;
    balanceMap[e.customerId] += e.type === "BILL" ? e.amount : -e.amount;
  }

  return NextResponse.json(
    customers.map((c) => ({ ...c, outstanding: balanceMap[c.id] ?? 0 }))
  );
}

export async function POST(req: NextRequest) {
  const ctx = await getOrgContext(req, {
    requireRoles: ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER"],
  });
  if (ctx.error) return ctx.error;

  const { name, phone, address, notes } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });

  const customer = await prisma.creditCustomer.create({
    data: { orgId: ctx.orgId!, name: name.trim(), phone: phone || null, address: address || null, notes: notes || null },
  });

  return NextResponse.json(customer, { status: 201 });
}

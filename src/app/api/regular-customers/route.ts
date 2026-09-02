import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrgContext } from "@/lib/orgGuard";

// GET /api/regular-customers
export async function GET(req: NextRequest) {
  const ctx = await getOrgContext(req, {
    requireRoles: ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER", "BILLER"],
  });
  if (ctx.error) return ctx.error;

  const customers = await prisma.regularCustomer.findMany({
    where: { orgId: ctx.orgId! },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(customers);
}

// POST /api/regular-customers
export async function POST(req: NextRequest) {
  const ctx = await getOrgContext(req, {
    requireRoles: ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER"],
  });
  if (ctx.error) return ctx.error;

  const body = await req.json();
  const { name, phone, address, notes, rateBreakfast, rateLunch, rateDinner } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const customer = await prisma.regularCustomer.create({
    data: {
      orgId: ctx.orgId!,
      name: name.trim(),
      phone: phone || null,
      address: address || null,
      notes: notes || null,
      rateBreakfast: rateBreakfast ? parseFloat(rateBreakfast) : null,
      rateLunch: rateLunch ? parseFloat(rateLunch) : null,
      rateDinner: rateDinner ? parseFloat(rateDinner) : null,
    },
  });

  return NextResponse.json(customer, { status: 201 });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrgContext } from "@/lib/orgGuard";

// PATCH /api/regular-customers/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getOrgContext(req, {
    requireRoles: ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER"],
  });
  if (ctx.error) return ctx.error;

  const { id } = await params;
  const body = await req.json();
  const { name, phone, address, notes, active, rateBreakfast, rateLunch, rateDinner } = body;

  const customer = await prisma.regularCustomer.updateMany({
    where: { id, orgId: ctx.orgId! },
    data: {
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(phone !== undefined ? { phone: phone || null } : {}),
      ...(address !== undefined ? { address: address || null } : {}),
      ...(notes !== undefined ? { notes: notes || null } : {}),
      ...(active !== undefined ? { active } : {}),
      ...(rateBreakfast !== undefined ? { rateBreakfast: rateBreakfast ? parseFloat(rateBreakfast) : null } : {}),
      ...(rateLunch !== undefined ? { rateLunch: rateLunch ? parseFloat(rateLunch) : null } : {}),
      ...(rateDinner !== undefined ? { rateDinner: rateDinner ? parseFloat(rateDinner) : null } : {}),
    },
  });

  return NextResponse.json(customer);
}

// DELETE /api/regular-customers/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getOrgContext(req, {
    requireRoles: ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER"],
  });
  if (ctx.error) return ctx.error;

  const { id } = await params;
  await prisma.regularCustomer.deleteMany({ where: { id, orgId: ctx.orgId! } });

  return NextResponse.json({ ok: true });
}

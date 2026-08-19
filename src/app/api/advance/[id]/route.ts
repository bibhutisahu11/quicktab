import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrgContext } from "@/lib/orgGuard";

// PATCH /api/advance/:id  – update (settle, edit)
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

  const record = await prisma.advancePayment.updateMany({
    where: { id, orgId: ctx.orgId! },
    data: {
      ...(body.partyType !== undefined && { partyType: body.partyType }),
      ...(body.customerName !== undefined && { customerName: body.customerName }),
      ...(body.phone !== undefined && { phone: body.phone }),
      ...(body.amount !== undefined && { amount: parseFloat(body.amount) }),
      ...(body.paymentMode !== undefined && { paymentMode: body.paymentMode }),
      ...(body.purpose !== undefined && { purpose: body.purpose }),
      ...(body.date !== undefined && { date: body.date }),
      ...(body.receivedBy !== undefined && { receivedBy: body.receivedBy }),
      ...(body.settled !== undefined && { settled: body.settled }),
      ...(body.settledOn !== undefined && { settledOn: body.settledOn }),
    },
  });

  return NextResponse.json({ ok: true, updated: record.count });
}

// DELETE /api/advance/:id
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getOrgContext(req, {
    requireRoles: ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER"],
  });
  if (ctx.error) return ctx.error;

  const { id } = await params;
  await prisma.advancePayment.deleteMany({
    where: { id, orgId: ctx.orgId! },
  });

  return NextResponse.json({ ok: true });
}

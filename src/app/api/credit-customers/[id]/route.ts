import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrgContext } from "@/lib/orgGuard";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getOrgContext(req, {
    requireRoles: ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER"],
  });
  if (ctx.error) return ctx.error;

  const data = await req.json();

  const existing = await prisma.creditCustomer.findFirst({
    where: { id: params.id, orgId: ctx.orgId! },
  });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  const updated = await prisma.creditCustomer.update({
    where: { id: params.id },
    data: {
      name:    data.name    !== undefined ? data.name.trim()   : undefined,
      phone:   data.phone   !== undefined ? (data.phone || null) : undefined,
      address: data.address !== undefined ? (data.address || null) : undefined,
      notes:   data.notes   !== undefined ? (data.notes || null) : undefined,
      active:  data.active  !== undefined ? data.active : undefined,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getOrgContext(req, {
    requireRoles: ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER"],
  });
  if (ctx.error) return ctx.error;

  await prisma.creditCustomer.deleteMany({
    where: { id: params.id, orgId: ctx.orgId! },
  });

  return NextResponse.json({ ok: true });
}

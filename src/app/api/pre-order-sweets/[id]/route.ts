import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/orgGuard";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getOrgContext(req, {
    requireRoles: ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER"],
  });
  if (ctx.error) return ctx.error;

  try {
    const { id } = await params;
    const body = await req.json();
    const { name, pricePerUnit, unit, available, sortOrder } = body;

    const sweet = await prisma.preOrderSweet.updateMany({
      where: {
        id,
        ...(ctx.orgId ? { orgId: ctx.orgId } : {}),
      },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(pricePerUnit !== undefined ? { pricePerUnit: parseFloat(String(pricePerUnit)) } : {}),
        ...(unit !== undefined ? { unit } : {}),
        ...(available !== undefined ? { available } : {}),
        ...(sortOrder !== undefined ? { sortOrder } : {}),
      },
    });

    if (sweet.count === 0) {
      return NextResponse.json({ error: "Sweet not found" }, { status: 404 });
    }

    const updated = await prisma.preOrderSweet.findUnique({ where: { id } });
    return NextResponse.json(updated);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getOrgContext(req, {
    requireRoles: ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER"],
  });
  if (ctx.error) return ctx.error;

  try {
    const { id } = await params;

    const deleted = await prisma.preOrderSweet.deleteMany({
      where: {
        id,
        ...(ctx.orgId ? { orgId: ctx.orgId } : {}),
      },
    });

    if (deleted.count === 0) {
      return NextResponse.json({ error: "Sweet not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

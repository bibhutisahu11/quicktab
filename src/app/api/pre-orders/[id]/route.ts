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
    const { status, adminNotes } = body;

    const updated = await prisma.preOrder.updateMany({
      where: {
        id,
        ...(ctx.orgId ? { orgId: ctx.orgId } : {}),
      },
      data: {
        ...(status !== undefined ? { status } : {}),
        ...(adminNotes !== undefined ? { adminNotes } : {}),
      },
    });

    if (updated.count === 0) {
      return NextResponse.json({ error: "Pre-order not found" }, { status: 404 });
    }

    const order = await prisma.preOrder.findUnique({ where: { id } });
    return NextResponse.json(order);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

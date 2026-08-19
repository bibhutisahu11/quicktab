import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/orgGuard";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/orders/:id/add-items
 * Body: { items: [{ menuItemId, name, price, quantity, notes? }] }
 * Allowed roles: HOTEL_ADMIN, MANAGER, SUPER_ADMIN, BILLER
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getOrgContext(req, {
    requireRoles: ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER", "BILLER"],
  });
  if (ctx.error) return ctx.error;

  const { id } = await params;

  try {
    const { items } = (await req.json()) as {
      items: { menuItemId?: string; name: string; price: number; quantity: number; notes?: string }[];
    };

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "items array is required" }, { status: 400 });
    }

    // Fetch existing order (scoped to org)
    const order = await prisma.order.findFirst({
      where: { id, ...(ctx.orgId ? { orgId: ctx.orgId } : {}) },
      include: { items: true },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (["DONE", "CANCELLED"].includes(order.status)) {
      return NextResponse.json({ error: "Cannot add items to a completed or cancelled order" }, { status: 400 });
    }

    // Calculate additional total
    const additionalTotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

    // Insert new OrderItems + update order total in a transaction
    const updated = await prisma.$transaction(async (tx) => {
      await tx.orderItem.createMany({
        data: items.map((i) => ({
          orderId: id,
          menuItemId: i.menuItemId ?? null,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          notes: i.notes ?? null,
        })),
      });

      return tx.order.update({
        where: { id },
        data: { total: { increment: additionalTotal } },
        include: { items: true, table: true },
      });
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

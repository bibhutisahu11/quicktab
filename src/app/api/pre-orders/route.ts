import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/orgGuard";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const ctx = await getOrgContext(req, {
    requireRoles: ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER"],
  });
  if (ctx.error) return ctx.error;

  try {
    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status");
    const statuses = statusParam ? statusParam.split(",").map((s) => s.trim()).filter(Boolean) : [];

    const orders = await prisma.preOrder.findMany({
      where: {
        ...(ctx.orgId ? { orgId: ctx.orgId } : {}),
        ...(statuses.length === 1
          ? { status: statuses[0] }
          : statuses.length > 1
          ? { status: { in: statuses } }
          : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(orders);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orgSlug, customerName, phone, items, notes } = body as {
      orgSlug: string;
      customerName: string;
      phone: string;
      items: { sweetId: string; quantity: number }[];
      notes?: string;
    };

    if (!orgSlug || !customerName || !phone || !items?.length) {
      return NextResponse.json(
        { error: "orgSlug, customerName, phone, and items are required" },
        { status: 400 }
      );
    }

    if (!/^\d{10}$/.test(phone.trim())) {
      return NextResponse.json(
        { error: "Phone must be exactly 10 digits" },
        { status: 400 }
      );
    }

    const org = await prisma.organization.findUnique({ where: { slug: orgSlug } });
    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const sweetIds = items.map((i) => i.sweetId);
    const sweets = await prisma.preOrderSweet.findMany({
      where: {
        id: { in: sweetIds },
        orgId: org.id,
        available: true,
      },
    });

    if (sweets.length !== sweetIds.length) {
      return NextResponse.json(
        { error: "One or more items are unavailable" },
        { status: 400 }
      );
    }

    const sweetMap = new Map(sweets.map((s) => [s.id, s]));

    let totalAmount = 0;
    const orderItems = items.map((item) => {
      const sweet = sweetMap.get(item.sweetId)!;
      const lineTotal = sweet.pricePerUnit * item.quantity;
      totalAmount += lineTotal;
      return {
        sweetId: item.sweetId,
        name: sweet.name,
        pricePerUnit: sweet.pricePerUnit,
        unit: sweet.unit,
        quantity: item.quantity,
        lineTotal,
      };
    });

    const paymentDeadline = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000);

    const preOrder = await prisma.preOrder.create({
      data: {
        orgId: org.id,
        customerName: customerName.trim(),
        phone: phone.trim(),
        items: orderItems,
        totalAmount,
        status: "PLACED",
        notes: notes ?? null,
        paymentDeadline,
      },
    });

    return NextResponse.json(preOrder, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

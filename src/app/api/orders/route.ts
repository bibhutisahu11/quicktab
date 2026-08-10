import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/orgGuard";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const ctx = await getOrgContext(req);
  if (ctx.error) return ctx.error;

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const type = searchParams.get("type");

    const orders = await prisma.order.findMany({
      where: {
        ...(ctx.orgId ? { orgId: ctx.orgId } : {}),
        ...(status && { status: status as never }),
        ...(type && { type: type as never }),
      },
      include: { items: true, table: true },
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
    const { type, tableToken, orgSlug, customerName, phone, email, birthday, deliveryAddress, notes, items, upiUtr, paymentScreenshot, discountAmount, paidAmount, parcelCharge, paymentMethod } = body;
    const isCash = paymentMethod === "CASH";

    if (!type || !customerName || !items?.length) {
      return NextResponse.json(
        { error: "type, customerName, and items are required" },
        { status: 400 }
      );
    }

    // Resolve org and table
    let tableId: string | null = null;
    let orgId: string | null = null;
    let orgUpiId: string | null = null;

    if (type === "TABLE") {
      if (!tableToken) {
        return NextResponse.json({ error: "tableToken required for table orders" }, { status: 400 });
      }
      const table = await prisma.table.findUnique({
        where: { qrToken: tableToken },
        include: { org: true },
      });
      if (!table) return NextResponse.json({ error: "Invalid table token" }, { status: 404 });
      if (!table.active) return NextResponse.json({ error: "Table is not active" }, { status: 400 });
      tableId = table.id;
      orgId = table.orgId ?? null;
      orgUpiId = table.org?.upiId ?? null;
    } else if (orgSlug) {
      const org = await prisma.organization.findUnique({ where: { slug: orgSlug } });
      if (org) { orgId = org.id; orgUpiId = org.upiId ?? null; }
    }

    // UPI-specific validations (skip for cash)
    if (!isCash && orgUpiId) {
      if (!upiUtr || upiUtr.trim().length < 6) {
        return NextResponse.json({ error: "Valid UTR / Transaction ID is required for payment" }, { status: 400 });
      }
      if (!paymentScreenshot) {
        return NextResponse.json({ error: "Payment screenshot is required" }, { status: 400 });
      }

      // ── Fraud detection: duplicate UTR ──────────────────────────────────
      const normalizedUtr = upiUtr.trim().toUpperCase();
      const existingUtr = await prisma.order.findFirst({
        where: {
          upiUtr: { equals: normalizedUtr, mode: "insensitive" },
          ...(orgId ? { orgId } : {}),
          status: { notIn: ["CANCELLED"] },
        },
        select: { id: true, customerName: true, createdAt: true },
      });

      if (existingUtr) {
        return NextResponse.json(
          {
            error: "⚠️ Fraud Detected: This UTR / Transaction ID has already been used for a previous order. Each payment must have a unique UTR. Please check your UPI app and use a new transaction.",
            fraudType: "DUPLICATE_UTR",
            existingOrderId: existingUtr.id,
          },
          { status: 409 }
        );
      }
    }

    // Validate menu items scoped to org
    const menuItemIds: string[] = items.map((i: { menuItemId: string }) => i.menuItemId);
    const menuItems = await prisma.menuItem.findMany({
      where: {
        id: { in: menuItemIds },
        available: true,
        ...(orgId ? { orgId } : {}),
      },
    });

    if (menuItems.length !== menuItemIds.length) {
      return NextResponse.json({ error: "One or more items are unavailable" }, { status: 400 });
    }

    const menuMap = new Map(menuItems.map((m) => [m.id, m]));
    let subtotal = 0;
    const orderItemsData = items.map((item: { menuItemId: string; quantity: number }) => {
      const menuItem = menuMap.get(item.menuItemId)!;
      subtotal += menuItem.price * item.quantity;
      return {
        menuItemId: item.menuItemId,
        name: menuItem.name,
        price: menuItem.price,
        quantity: item.quantity,
      };
    });

    const appliedDiscount = Math.min(Number(discountAmount) || 0, subtotal);
    const appliedParcelCharge = Math.max(0, Number(parcelCharge) || 0);
    const total = Math.max(0, subtotal - appliedDiscount + appliedParcelCharge);

    // ── Server-side paid-amount check (UPI only) ─────────────────────────────
    if (!isCash && orgUpiId && paidAmount !== undefined) {
      const paid = parseFloat(String(paidAmount));
      if (isNaN(paid) || Math.abs(paid - total) > 1) {
        return NextResponse.json(
          { error: `Payment amount ₹${paid.toFixed(2)} does not match order total ₹${total.toFixed(2)}. Please pay the exact amount.` },
          { status: 400 }
        );
      }
    }

    // Detect repeat diner: same phone/table with an active order in the last 90 minutes
    let isRepeatDiner = false;
    if (orgId) {
      const since = new Date(Date.now() - 90 * 60 * 1000);
      const activeStatuses = ["PENDING", "PAYMENT_PENDING", "PREPARING", "READY"];
      const existingOrder = await prisma.order.findFirst({
        where: {
          orgId,
          createdAt: { gte: since },
          status: { in: activeStatuses as never[] },
          OR: [
            ...(phone ? [{ phone }] : []),
            ...(tableId ? [{ tableId }] : []),
          ],
        },
      });
      if (existingOrder) isRepeatDiner = true;
    }

    const order = await prisma.order.create({
      data: {
        type,
        tableId,
        orgId,
        customerName,
        phone: phone ?? null,
        email: email ?? null,
        birthday: birthday ?? null,
        deliveryAddress: deliveryAddress ?? null,
        notes: notes ?? null,
        discountAmount: appliedDiscount,
        total,
        isRepeatDiner,
        // If org has UPI, order waits for admin verification before entering the kitchen queue
        status: orgUpiId ? "PAYMENT_PENDING" : "PENDING",
        upiUtr: upiUtr ?? null,
        paymentScreenshot: paymentScreenshot ?? null,
        screenshotExpiry: paymentScreenshot
          ? new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
          : null,
        parcelCharge: appliedParcelCharge,
        paymentMethod: isCash ? "CASH" : "UPI",
        items: { create: orderItemsData },
      },
      include: { items: true, table: true },
    });

    return NextResponse.json(order, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

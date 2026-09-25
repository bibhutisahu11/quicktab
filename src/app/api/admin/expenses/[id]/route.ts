import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/orgGuard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getOrgContext(req);
  if (ctx.error) return ctx.error;
  if (!["HOTEL_ADMIN", "MANAGER", "SUPER_ADMIN", "BILLER"].includes(ctx.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if ("amount"      in body) data.amount      = Number(body.amount);
  if ("category"    in body) data.category    = body.category;
  if ("subCategory" in body) data.subCategory = body.subCategory ?? null;
  if ("description" in body) data.description = body.description ?? null;
  if ("quantity"    in body) data.quantity    = body.quantity != null ? Number(body.quantity) : null;
  if ("unit"        in body) data.unit        = body.unit ?? null;
  if ("date"        in body) data.date        = new Date(body.date as string);
  if ("paymentMode" in body) data.paymentMode = body.paymentMode;

  const updated = await prisma.expense.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getOrgContext(req);
  if (ctx.error) return ctx.error;
  if (!["HOTEL_ADMIN", "SUPER_ADMIN"].includes(ctx.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await prisma.expense.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/orgGuard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const WRITE_ROLES = ["HOTEL_ADMIN", "MANAGER", "SUPER_ADMIN", "BILLER"];

export async function GET(req: NextRequest) {
  const ctx = await getOrgContext(req);
  if (ctx.error) return ctx.error;

  const { searchParams } = new URL(req.url);
  const from  = searchParams.get("from");
  const to    = searchParams.get("to");
  const cat   = searchParams.get("category");

  const where: Record<string, unknown> = {
    ...(ctx.orgId ? { orgId: ctx.orgId } : {}),
    ...(cat ? { category: cat } : {}),
    ...(from || to ? {
      date: {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to   ? { lte: new Date(to + "T23:59:59") } : {}),
      },
    } : {}),
  };

  const expenses = await prisma.expense.findMany({ where, orderBy: { date: "desc" } });

  const totalAmount = expenses.reduce((s, e) => s + e.amount, 0);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart  = new Date(now.getFullYear(), 0, 1);

  const todayTotal = expenses.filter((e) => new Date(e.date) >= todayStart).reduce((s, e) => s + e.amount, 0);
  const monthTotal = expenses.filter((e) => new Date(e.date) >= monthStart).reduce((s, e) => s + e.amount, 0);
  const yearTotal  = expenses.filter((e) => new Date(e.date) >= yearStart).reduce((s, e) => s + e.amount, 0);

  const byCategory = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.amount;
    return acc;
  }, {} as Record<string, number>);

  // Analytics: product-level aggregations (for admin analytics tab)
  const productMap: Record<string, { count: number; total: number; category: string }> = {};
  for (const e of expenses) {
    const key = e.subCategory || e.description || "Uncategorised";
    if (!productMap[key]) productMap[key] = { count: 0, total: 0, category: e.category };
    productMap[key].count++;
    productMap[key].total += e.amount;
  }
  const productStats = Object.entries(productMap)
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.total - a.total);

  return NextResponse.json({ expenses, totalAmount, todayTotal, monthTotal, yearTotal, byCategory, productStats });
}

export async function POST(req: NextRequest) {
  const ctx = await getOrgContext(req);
  if (ctx.error) return ctx.error;
  if (!WRITE_ROLES.includes(ctx.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { amount, category, subCategory, description, quantity, unit, date, paymentMode, addedBy } = await req.json();
  if (!amount || !category) {
    return NextResponse.json({ error: "amount and category are required" }, { status: 400 });
  }

  const expense = await prisma.expense.create({
    data: {
      amount:      Number(amount),
      category,
      subCategory: subCategory ?? null,
      description: description ?? null,
      quantity:    quantity != null ? Number(quantity) : null,
      unit:        unit ?? null,
      date:        date ? new Date(date) : new Date(),
      paymentMode: paymentMode ?? "Cash",
      orgId:       ctx.orgId ?? null,
      addedBy:     addedBy ?? ctx.role ?? null,
    },
  });

  return NextResponse.json(expense, { status: 201 });
}

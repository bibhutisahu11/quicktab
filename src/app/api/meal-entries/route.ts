import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrgContext } from "@/lib/orgGuard";

// GET /api/meal-entries?date=YYYY-MM-DD  OR  ?month=YYYY-MM  OR  ?customerId=xxx&month=YYYY-MM
export async function GET(req: NextRequest) {
  const ctx = await getOrgContext(req, {
    requireRoles: ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER", "BILLER"],
  });
  if (ctx.error) return ctx.error;

  const { searchParams } = new URL(req.url);
  const date       = searchParams.get("date");
  const month      = searchParams.get("month");
  const customerId = searchParams.get("customerId");

  const entries = await prisma.mealEntry.findMany({
    where: {
      orgId: ctx.orgId!,
      ...(customerId ? { customerId } : {}),
      ...(date  ? { date } : {}),
      ...(month ? { date: { startsWith: month } } : {}),
    },
    orderBy: { date: "asc" },
  });

  return NextResponse.json(entries);
}

// POST /api/meal-entries — upsert a single day's meal entry
export async function POST(req: NextRequest) {
  const ctx = await getOrgContext(req, {
    requireRoles: ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER", "BILLER"],
  });
  if (ctx.error) return ctx.error;

  const body = await req.json();
  const { customerId, date, breakfast, lunch, dinner, notes } = body;

  if (!customerId || !date) {
    return NextResponse.json({ error: "customerId and date are required" }, { status: 400 });
  }

  const entry = await prisma.mealEntry.upsert({
    where: { customerId_date: { customerId, date } },
    create: {
      orgId: ctx.orgId!,
      customerId,
      date,
      breakfast: breakfast ?? false,
      lunch:     lunch     ?? false,
      dinner:    dinner    ?? false,
      notes:     notes     || null,
    },
    update: {
      breakfast: breakfast ?? false,
      lunch:     lunch     ?? false,
      dinner:    dinner    ?? false,
      notes:     notes     !== undefined ? (notes || null) : undefined,
    },
  });

  return NextResponse.json(entry);
}

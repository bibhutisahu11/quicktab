import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/orgGuard";
import { prisma } from "@/lib/prisma";

// GET /api/attendance?date=YYYY-MM-DD&month=YYYY-MM
export async function GET(req: NextRequest) {
  const ctx = await getOrgContext(req, {
    requireRoles: ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER"],
  });
  if (ctx.error) return ctx.error;

  const { searchParams } = new URL(req.url);
  const date  = searchParams.get("date");   // single day
  const month = searchParams.get("month");  // YYYY-MM for monthly view

  try {
    // Fetch staff for this org
    const staff = await prisma.admin.findMany({
      where: {
        ...(ctx.isSuperAdmin ? {} : { orgId: ctx.orgId }),
        role: { not: "SUPER_ADMIN" },
      },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    });

    // Build date filter
    let dateFilter: { date?: string; date_startsWith?: never } | { date: { startsWith: string } };
    if (date) {
      dateFilter = { date };
    } else if (month) {
      dateFilter = { date: { startsWith: month } } as { date: { startsWith: string } };
    } else {
      const today = new Date().toISOString().slice(0, 10);
      dateFilter = { date: today };
    }

    const records = await prisma.attendance.findMany({
      where: {
        ...(ctx.isSuperAdmin ? {} : { orgId: ctx.orgId }),
        ...dateFilter,
      },
      orderBy: { date: "desc" },
    });

    return NextResponse.json({ staff, records });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/attendance  — upsert one record
export async function POST(req: NextRequest) {
  const ctx = await getOrgContext(req, {
    requireRoles: ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER"],
  });
  if (ctx.error) return ctx.error;

  try {
    const body = await req.json();
    const { adminId, date, status, checkIn, checkOut, notes } = body;

    if (!adminId || !date || !status) {
      return NextResponse.json({ error: "adminId, date, status required" }, { status: 400 });
    }

    const record = await prisma.attendance.upsert({
      where: { adminId_date: { adminId, date } },
      create: {
        adminId,
        orgId: ctx.orgId ?? null,
        date,
        status,
        checkIn:  checkIn  || null,
        checkOut: checkOut || null,
        notes:    notes    || null,
      },
      update: {
        status,
        checkIn:  checkIn  !== undefined ? (checkIn  || null) : undefined,
        checkOut: checkOut !== undefined ? (checkOut || null) : undefined,
        notes:    notes    !== undefined ? (notes    || null) : undefined,
      },
    });

    return NextResponse.json(record);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

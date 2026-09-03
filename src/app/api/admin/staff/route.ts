import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/orgGuard";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ctx = await getOrgContext(req, {
    requireRoles: ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER", "BILLER"],
  });
  if (ctx.error) return ctx.error;
  if (!ctx.orgId) return NextResponse.json({ error: "No org context" }, { status: 400 });

  try {
    const staff = await prisma.admin.findMany({
      where: { orgId: ctx.orgId, role: { not: "SUPER_ADMIN" } },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(staff);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const ctx = await getOrgContext(req, {
    requireRoles: ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER"],
  });
  if (ctx.error) return ctx.error;
  if (!ctx.orgId) return NextResponse.json({ error: "No org context" }, { status: 400 });

  try {
    const { email, name, role, password } = await req.json();

    if (!email || !role || !password) {
      return NextResponse.json(
        { error: "email, role, and password are required" },
        { status: 400 }
      );
    }

    const allowedRoles = ["HOTEL_ADMIN", "MANAGER", "WAITER", "KITCHEN", "BILLER"];
    if (!allowedRoles.includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // Managers can only create WAITER and KITCHEN
    if (ctx.role === "MANAGER" && !["WAITER", "KITCHEN"].includes(role)) {
      return NextResponse.json(
        { error: "Managers can only create WAITER or KITCHEN accounts" },
        { status: 403 }
      );
    }

    const existing = await prisma.admin.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const staff = await prisma.admin.create({
      data: { email, name: name ?? email, role, orgId: ctx.orgId, passwordHash },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });

    return NextResponse.json(staff, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

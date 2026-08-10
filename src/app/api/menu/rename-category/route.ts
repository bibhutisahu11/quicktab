import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/orgGuard";
import { prisma } from "@/lib/prisma";

// PATCH /api/menu/rename-category  { oldName, newName }
// Renames all menu items in a category for the admin's org.
export async function PATCH(req: NextRequest) {
  const ctx = await getOrgContext(req, {
    requireRoles: ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER"],
  });
  if (ctx.error) return ctx.error;

  try {
    const { oldName, newName } = await req.json() as { oldName: string; newName: string };
    if (!oldName?.trim() || !newName?.trim()) {
      return NextResponse.json({ error: "oldName and newName are required" }, { status: 400 });
    }
    if (oldName.trim() === newName.trim()) {
      return NextResponse.json({ ok: true, updated: 0 });
    }

    const result = await prisma.menuItem.updateMany({
      where: {
        category: oldName.trim(),
        ...(ctx.orgId ? { OR: [{ orgId: ctx.orgId }, { orgId: null }] } : {}),
      },
      data: { category: newName.trim() },
    });

    return NextResponse.json({ ok: true, updated: result.count });
  } catch (err) {
    console.error("PATCH /api/menu/rename-category error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

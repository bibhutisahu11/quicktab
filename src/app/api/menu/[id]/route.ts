import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/orgGuard";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getOrgContext(req, {
    requireRoles: ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER", "BILLER"],
  });
  if (ctx.error) return ctx.error;

  try {
    const { id } = await params;
    const body = await req.json();
    const { name, description, price, category, imageUrl, available, isVeg, sortOrder, unit } = body;

    const data = {
      ...(name && { name }),
      ...(description !== undefined && { description }),
      ...(price !== undefined && { price: parseFloat(price) }),
      ...(category && { category }),
      ...(imageUrl !== undefined && { imageUrl }),
      ...(available !== undefined && { available }),
      ...(isVeg !== undefined && { isVeg: Boolean(isVeg) }),
      ...(sortOrder !== undefined && { sortOrder }),
      ...(unit !== undefined && { unit: unit || null }),
    };

    // Try with orgId guard first; fall back to id-only for legacy/script-inserted items
    let item;
    try {
      item = await prisma.menuItem.update({
        where: { id, ...(ctx.orgId ? { orgId: ctx.orgId } : {}) },
        data,
      });
    } catch (inner) {
      if ((inner as { code?: string }).code === "P2025" && ctx.orgId) {
        // Item may have been inserted without orgId — retry without orgId guard
        // but verify org ownership separately to stay secure
        const existing = await prisma.menuItem.findUnique({ where: { id } });
        if (!existing || (existing.orgId && existing.orgId !== ctx.orgId && !ctx.isSuperAdmin)) {
          return NextResponse.json({ error: "Item not found" }, { status: 404 });
        }
        item = await prisma.menuItem.update({ where: { id }, data });
      } else {
        throw inner;
      }
    }
    return NextResponse.json(item);
  } catch (err) {
    console.error("PUT /api/menu error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getOrgContext(req, {
    requireRoles: ["SUPER_ADMIN", "HOTEL_ADMIN"], // BILLER intentionally excluded
  });
  if (ctx.error) return ctx.error;

  try {
    const { id } = await params;

    // Detach this menu item from any existing order items before deleting,
    // so order history is preserved even if the FK is still NOT NULL in the DB.
    await prisma.$executeRawUnsafe(
      `UPDATE order_items SET "menuItemId" = NULL WHERE "menuItemId" = $1`,
      id
    );

    // Try deleting with orgId guard first
    try {
      await prisma.menuItem.delete({
        where: { id, ...(ctx.orgId ? { orgId: ctx.orgId } : {}) },
      });
    } catch (inner) {
      if ((inner as { code?: string }).code === "P2025" && ctx.orgId) {
        // Item may have been inserted without orgId (e.g. via script).
        // Verify it exists and belongs to no other org before deleting by id only.
        const existing = await prisma.menuItem.findUnique({ where: { id } });
        if (!existing) {
          // Already gone — treat as success
          return NextResponse.json({ success: true });
        }
        if (existing.orgId && existing.orgId !== ctx.orgId && !ctx.isSuperAdmin) {
          return NextResponse.json({ error: "Item not found" }, { status: 404 });
        }
        // Safe to delete — item has null orgId or belongs to this org
        await prisma.menuItem.delete({ where: { id } });
      } else {
        throw inner;
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/menu error:", err);
    if ((err as { code?: string }).code === "P2025") {
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

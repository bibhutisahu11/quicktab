import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/orgGuard";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orgSlug = searchParams.get("orgSlug");
    const orgId = searchParams.get("orgId");

    // Resolve org filter: by id, by slug, or public (no filter)
    let resolvedOrgId: string | undefined;
    if (orgId) {
      resolvedOrgId = orgId;
    } else if (orgSlug) {
      const org = await prisma.organization.findUnique({ where: { slug: orgSlug } });
      if (!org) return NextResponse.json([], { status: 200 });
      resolvedOrgId = org.id;
    }

    const items = await prisma.menuItem.findMany({
      where: { ...(resolvedOrgId ? { orgId: resolvedOrgId } : {}) },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    });
    return NextResponse.json(items);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/menu  { updates: [{id, available}] }  – bulk availability toggle
export async function PATCH(req: NextRequest) {
  const ctx = await getOrgContext(req, {
    requireRoles: ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER", "BILLER"],
  });
  if (ctx.error) return ctx.error;

  try {
    const { updates } = await req.json() as { updates: { id: string; available: boolean }[] };
    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: "updates array required" }, { status: 400 });
    }

    // Use updateMany per item — it returns { count: 0 } instead of throwing P2025
    // when an item's orgId doesn't match (e.g. items inserted via scripts without orgId).
    // First attempt with orgId filter; if nothing updated, retry without orgId guard
    // so legacy/script-inserted items are still reachable by the owning admin.
    const results = await prisma.$transaction(
      updates.map(({ id, available }) =>
        prisma.menuItem.updateMany({
          where: {
            id,
            ...(ctx.orgId ? { OR: [{ orgId: ctx.orgId }, { orgId: null }] } : {}),
          },
          data: { available },
        })
      )
    );
    const updated = results.reduce((s, r) => s + r.count, 0);
    return NextResponse.json({ ok: true, updated, total: updates.length });
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

  try {
    const body = await req.json();

    // Bulk import: { items: [...] }
    if (Array.isArray(body.items)) {
      const created = await prisma.$transaction(
        body.items.map(
          (it: {
            name: string;
            description?: string;
            price: number;
            category: string;
            imageUrl?: string;
            available?: boolean;
            sortOrder?: number;
          }) =>
            prisma.menuItem.create({
              data: {
                name: it.name,
                description: it.description ?? null,
                price: parseFloat(String(it.price)),
                category: it.category,
                imageUrl: it.imageUrl ?? null,
                available: it.available ?? true,
                sortOrder: it.sortOrder ?? 0,
                orgId: ctx.orgId,
              },
            })
        )
      );
      return NextResponse.json({ created, count: created.length }, { status: 201 });
    }

    const { name, description, price, category, imageUrl, available, sortOrder } = body;
    if (!name || !price || !category) {
      return NextResponse.json(
        { error: "name, price, and category are required" },
        { status: 400 }
      );
    }

    const item = await prisma.menuItem.create({
      data: {
        name,
        description: description ?? null,
        price: parseFloat(price),
        category,
        imageUrl: imageUrl ?? null,
        available: available ?? true,
        sortOrder: sortOrder ?? 0,
        orgId: ctx.orgId,
      },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

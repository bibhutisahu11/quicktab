import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/orgGuard";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orgSlug = searchParams.get("orgSlug");

    let orgId: string | undefined;
    if (orgSlug) {
      const org = await prisma.organization.findUnique({ where: { slug: orgSlug } });
      if (!org) return NextResponse.json([], { status: 200 });
      orgId = org.id;
    }

    const sweets = await prisma.preOrderSweet.findMany({
      where: {
        ...(orgId ? { orgId } : {}),
        available: true,
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return NextResponse.json(sweets);
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
    const { name, pricePerUnit, unit, available, sortOrder, imageUrl } = body;

    if (!name || pricePerUnit === undefined) {
      return NextResponse.json({ error: "name and pricePerUnit are required" }, { status: 400 });
    }

    const orgId = ctx.orgId;
    if (!orgId) {
      return NextResponse.json({ error: "No org context" }, { status: 400 });
    }

    const sweet = await prisma.preOrderSweet.create({
      data: {
        orgId,
        name,
        pricePerUnit: parseFloat(String(pricePerUnit)),
        unit: unit ?? "piece",
        available: available ?? true,
        sortOrder: sortOrder ?? 0,
        imageUrl: imageUrl ?? null,
      },
    });

    return NextResponse.json(sweet, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

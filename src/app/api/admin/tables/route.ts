import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/orgGuard";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const ctx = await getOrgContext(req, {
    requireRoles: ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER", "BILLER"],
  });
  if (ctx.error) return ctx.error;

  try {
    const [tables, org] = await Promise.all([
      prisma.table.findMany({
        where: { ...(ctx.orgId ? { orgId: ctx.orgId } : {}) },
        orderBy: { name: "asc" },
      }),
      ctx.orgId
        ? prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { slug: true } })
        : null,
    ]);
    return NextResponse.json({ tables, orgSlug: org?.slug ?? null });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/public/check-utr?utr=XXX&orgSlug=kalinga-bites
 * Returns { isDuplicate: true/false }
 * Used for real-time client-side fraud check before submitting.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const utr     = searchParams.get("utr")?.trim().toUpperCase();
  const orgSlug = searchParams.get("orgSlug")?.trim();

  if (!utr || utr.length < 6) return NextResponse.json({ isDuplicate: false });

  try {
    const org = orgSlug
      ? await prisma.organization.findUnique({ where: { slug: orgSlug }, select: { id: true } })
      : null;

    const existing = await prisma.order.findFirst({
      where: {
        upiUtr: { equals: utr, mode: "insensitive" },
        ...(org ? { orgId: org.id } : {}),
        status: { notIn: ["CANCELLED"] },
      },
      select: { id: true },
    });

    return NextResponse.json({ isDuplicate: !!existing });
  } catch {
    return NextResponse.json({ isDuplicate: false });
  }
}

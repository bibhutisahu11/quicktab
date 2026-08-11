import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// POST /api/feedback  — public, no auth needed
export async function POST(req: NextRequest) {
  try {
    const { orgId, orderId, rating, experience, improvement, customerName, phone } = await req.json();

    if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });
    if (!rating || rating < 1 || rating > 5) return NextResponse.json({ error: "rating must be 1–5" }, { status: 400 });

    // Verify org exists
    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { id: true } });
    if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

    const fb = await prisma.feedback.create({
      data: {
        orgId,
        orderId: orderId || null,
        rating: Number(rating),
        experience: experience?.trim() || null,
        improvement: improvement?.trim() || null,
        customerName: customerName?.trim() || null,
        phone: phone?.trim() || null,
      },
    });

    return NextResponse.json(fb);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to save feedback" }, { status: 500 });
  }
}

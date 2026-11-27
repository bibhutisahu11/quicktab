import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

const ALLOWED_DATES = ["2024-11-28", "2024-11-29"];

// ── POST — public booking submission ────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { name, phone, persons, visitDate, visitTime, orgSlug } = await req.json() as {
      name: string; phone: string; persons: number;
      visitDate: string; visitTime: string; orgSlug: string;
    };

    // Validations
    if (!name?.trim())                 return NextResponse.json({ error: "Name is required" }, { status: 400 });
    if (name.trim().length < 2)        return NextResponse.json({ error: "Name must be at least 2 characters" }, { status: 400 });
    if (!/^\d{10}$/.test(phone?.trim())) return NextResponse.json({ error: "Phone must be exactly 10 digits" }, { status: 400 });
    if (!persons || persons < 1)       return NextResponse.json({ error: "At least 1 person required" }, { status: 400 });
    if (persons > 50)                  return NextResponse.json({ error: "Maximum 50 persons per booking" }, { status: 400 });
    if (!ALLOWED_DATES.includes(visitDate)) return NextResponse.json({ error: "Date must be 28th or 29th November" }, { status: 400 });
    if (!visitTime?.trim())            return NextResponse.json({ error: "Time of visit is required" }, { status: 400 });
    if (!orgSlug)                      return NextResponse.json({ error: "Organization not specified" }, { status: 400 });

    const org = await prisma.organization.findUnique({ where: { slug: orgSlug } });
    if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

    // Check for duplicate phone on same date
    const existing = await (prisma as any).chhadakhaiBooking.findFirst({
      where: { orgId: org.id, phone: phone.trim(), visitDate },
    });
    if (existing) return NextResponse.json({ error: "A booking already exists for this phone number on that date" }, { status: 409 });

    const booking = await (prisma as any).chhadakhaiBooking.create({
      data: {
        id: randomUUID(),
        orgId: org.id,
        name: name.trim(),
        phone: phone.trim(),
        persons: Number(persons),
        visitDate,
        visitTime: visitTime.trim(),
        status: "CONFIRMED",
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, bookingId: booking.id }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

// ── GET — admin view ─────────────────────────────────────────────────────────
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const bookings = await (prisma as any).chhadakhaiBooking.findMany({
    where: { orgId: session.user.orgId },
    orderBy: [{ visitDate: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(bookings);
}

// ── PATCH — admin update status ──────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, status } = await req.json() as { id: string; status: string };
  await (prisma as any).chhadakhaiBooking.update({
    where: { id },
    data: { status, updatedAt: new Date() },
  });
  return NextResponse.json({ success: true });
}

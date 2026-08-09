import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/orgGuard";
import { prisma } from "@/lib/prisma";
import QRCode from "qrcode";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getOrgContext(req);
  if (ctx.error) return ctx.error;

  try {
    const { id } = await params;
    const table = await prisma.table.findUnique({
      where: { id },
      include: { org: true },
    });
    if (!table) return NextResponse.json({ error: "Table not found" }, { status: 404 });

    // Basic org check: non-super-admins can only download QR for their own org's tables
    if (!ctx.isSuperAdmin && ctx.orgId && table.orgId !== ctx.orgId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const orgSlug = table.org?.slug ?? "my-hotel";
    const url = `${baseUrl}/${orgSlug}/menu/${table.qrToken}`;

    const dataUrl = await QRCode.toDataURL(url, {
      width: 400,
      margin: 2,
      color: { dark: "#1e293b", light: "#ffffff" },
      type: "image/png",
    });

    // Strip the "data:image/png;base64," prefix and decode to binary
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
    const buffer = Buffer.from(base64, "base64");

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="${table.name.replace(/\s+/g, "-")}-qr.png"`,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

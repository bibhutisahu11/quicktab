import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Vercel cron job — runs daily at midnight.
 * Deletes paymentScreenshot (base64 blob) from orders whose screenshotExpiry
 * has passed, but preserves the UTR for audit/reconciliation.
 */
export async function GET(req: NextRequest) {
  // Verify the request is from Vercel Cron (production) or allow localhost
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  const result = await prisma.order.updateMany({
    where: {
      paymentScreenshot: { not: null },
      screenshotExpiry: { lte: now },
    },
    data: {
      paymentScreenshot: null,
      // screenshotExpiry stays so we know it was cleaned up
    },
  });

  return NextResponse.json({
    ok: true,
    purged: result.count,
    at: now.toISOString(),
  });
}

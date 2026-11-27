import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId) return NextResponse.json({ lunchMissed: false, dinnerMissed: false });

  // Today's date in IST (UTC+5:30)
  const nowUTC = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const nowIST = new Date(nowUTC.getTime() + istOffset);
  const todayStr = nowIST.toISOString().slice(0, 10); // "YYYY-MM-DD"
  const hourIST = nowIST.getUTCHours(); // hours in IST

  // Only check if past the meal cutoff
  const checkLunch  = hourIST >= 13; // after 1 PM IST
  const checkDinner = hourIST >= 20; // after 8 PM IST

  if (!checkLunch && !checkDinner) {
    return NextResponse.json({ lunchMissed: false, dinnerMissed: false });
  }

  // Check if any mess customer exists for this org
  const customerCount = await prisma.regularCustomer.count({
    where: { orgId: session.user.orgId, active: true },
  });

  if (customerCount === 0) {
    return NextResponse.json({ lunchMissed: false, dinnerMissed: false });
  }

  // Check today's entries
  const todayEntries = await prisma.mealEntry.findMany({
    where: { orgId: session.user.orgId, date: todayStr },
    select: { lunch: true, dinner: true },
  });

  const lunchMarked  = todayEntries.some((e) => e.lunch);
  const dinnerMarked = todayEntries.some((e) => e.dinner);

  return NextResponse.json({
    lunchMissed:  checkLunch  && !lunchMarked,
    dinnerMissed: checkDinner && !dinnerMarked,
    todayStr,
  });
}

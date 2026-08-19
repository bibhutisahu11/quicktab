export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import MenuPage from "@/components/MenuPage";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

const STAFF_ROLES = new Set(["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER", "BILLER", "WAITER", "KITCHEN"]);

export default async function ParcelMenuPage({ params }: Props) {
  const { orgSlug } = await params;

  const [org, session] = await Promise.all([
    prisma.organization.findUnique({ where: { slug: orgSlug } }),
    getServerSession(authOptions),
  ]);
  if (!org || !org.active) notFound();

  const isAdmin = !!(session?.user?.role && STAFF_ROLES.has(session.user.role));

  const menuItems = await prisma.menuItem.findMany({
    where: { orgId: org.id },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
  });

  return <MenuPage menuItems={menuItems} orgSlug={orgSlug} orgName={org.name} orgUpiId={org.upiId ?? null} isAdmin={isAdmin} />;
}

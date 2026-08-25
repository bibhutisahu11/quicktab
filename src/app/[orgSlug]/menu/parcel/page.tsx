export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import MenuPage from "@/components/MenuPage";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { unstable_cache } from "next/cache";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

const STAFF_ROLES = new Set(["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER", "BILLER", "WAITER", "KITCHEN"]);

const getMenuItems = unstable_cache(
  async (orgId: string) =>
    prisma.menuItem.findMany({
      where: { orgId },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
      select: {
        id: true, name: true, price: true, category: true,
        available: true, unit: true, isVeg: true, sortOrder: true,
        description: true, imageUrl: true,
      },
    }),
  ["menu-items"],
  { revalidate: 60, tags: ["menu"] }
);

const getOrg = unstable_cache(
  async (slug: string) =>
    prisma.organization.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true, active: true, upiId: true },
    }),
  ["org-by-slug"],
  { revalidate: 300, tags: ["org"] }
);

export default async function ParcelMenuPage({ params }: Props) {
  const { orgSlug } = await params;

  const [org, session] = await Promise.all([
    getOrg(orgSlug),
    getServerSession(authOptions),
  ]);
  if (!org || !org.active) notFound();

  const isAdmin = !!(session?.user?.role && STAFF_ROLES.has(session.user.role));

  const menuItems = await getMenuItems(org.id);

  return <MenuPage menuItems={menuItems} orgSlug={orgSlug} orgName={org.name} orgUpiId={org.upiId ?? null} isAdmin={isAdmin} />;
}

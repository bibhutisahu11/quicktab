export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import MenuPage from "@/components/MenuPage";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { unstable_cache } from "next/cache";

interface Props {
  params: Promise<{ orgSlug: string; tableId: string }>;
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
      select: { id: true, name: true, slug: true, active: true, upiId: true, logoUrl: true },
    }),
  ["org-by-slug"],
  { revalidate: 300, tags: ["org"] }
);

export default async function TableMenuPage({ params }: Props) {
  const { orgSlug, tableId } = await params;

  const [org, session] = await Promise.all([
    getOrg(orgSlug),
    getServerSession(authOptions),
  ]);
  if (!org || !org.active) notFound();

  const isAdmin = !!(session?.user?.role && STAFF_ROLES.has(session.user.role));

  const [table, menuItems] = await Promise.all([
    prisma.table.findUnique({
      where: { qrToken: tableId, orgId: org.id },
    }),
    getMenuItems(org.id),
  ]);

  if (!table || !table.active) notFound();

  return (
    <MenuPage
      menuItems={menuItems}
      tableToken={table.qrToken}
      tableName={table.name}
      orgSlug={orgSlug}
      orgName={org.name}
      orgLogo={org.logoUrl ?? null}
      orgUpiId={org.upiId ?? null}
      isAdmin={isAdmin}
    />
  );
}

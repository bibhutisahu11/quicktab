export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PreOrderForm from "@/components/PreOrderForm";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

export default async function PreOrderPage({ params }: Props) {
  const { orgSlug } = await params;

  const org = await prisma.organization.findUnique({ where: { slug: orgSlug } });
  if (!org || !org.active) notFound();

  const sweets = await prisma.preOrderSweet.findMany({
    where: { orgId: org.id, available: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return (
    <PreOrderForm
      orgSlug={orgSlug}
      orgName={org.name}
      sweets={sweets.map((s) => ({
        id: s.id,
        name: s.name,
        pricePerUnit: s.pricePerUnit,
        unit: s.unit,
      }))}
    />
  );
}

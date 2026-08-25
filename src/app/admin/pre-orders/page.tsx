export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import PreOrderManager from "@/components/PreOrderManager";

const ALLOWED_ROLES = new Set(["HOTEL_ADMIN", "MANAGER", "SUPER_ADMIN"]);

export default async function PreOrdersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/admin");
  if (!ALLOWED_ROLES.has(session.user.role ?? "")) redirect("/admin/dashboard");

  return <PreOrderManager orgSlug={session.user.orgSlug ?? ""} />;
}

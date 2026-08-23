export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import NewOrderPage from "@/components/NewOrderPage";

const ALLOWED = ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER", "BILLER"];

export default async function AdminNewOrderPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/admin");
  if (!ALLOWED.includes(session.user.role)) redirect("/admin/dashboard");

  return <NewOrderPage orgSlug={session.user.orgSlug ?? ""} />;
}

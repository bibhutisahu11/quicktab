export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import AdvanceManager from "@/components/AdvanceManager";

export default async function AdvancePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/admin");

  const role = session.user.role;
  if (!["HOTEL_ADMIN", "MANAGER", "SUPER_ADMIN", "BILLER"].includes(role)) {
    redirect("/admin/dashboard");
  }

  return <AdvanceManager />;
}

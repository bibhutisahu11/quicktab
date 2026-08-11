export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import WaiterDashboard from "@/components/WaiterDashboard";
import SuperAdminDashboard from "@/components/SuperAdminDashboard";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/admin");

  const role = session.user.role;
  // Role-based redirects for non-dashboard roles
  if (role === "BILLER")   redirect("/admin/orders");
  if (role === "WAITER")   redirect("/admin/orders");
  if (role === "KITCHEN")  redirect("/admin/kitchen");

  if (role === "SUPER_ADMIN") return <SuperAdminDashboard />;

  // HOTEL_ADMIN and MANAGER see the orders/waiter dashboard
  return <WaiterDashboard />;
}

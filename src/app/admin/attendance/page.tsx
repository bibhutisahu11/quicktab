export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import AttendanceManager from "@/components/AttendanceManager";

export default async function AttendancePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/admin");

  const role = session.user.role;
  if (!["HOTEL_ADMIN", "MANAGER", "SUPER_ADMIN"].includes(role)) {
    redirect("/admin/dashboard");
  }

  return <AttendanceManager />;
}

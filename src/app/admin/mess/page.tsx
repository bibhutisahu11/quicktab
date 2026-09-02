export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import MealTracker from "@/components/MealTracker";

export default async function MessPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/admin");

  const role = session.user.role;
  if (!["HOTEL_ADMIN", "MANAGER", "SUPER_ADMIN", "BILLER"].includes(role)) {
    redirect("/admin/dashboard");
  }

  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      <MealTracker />
    </div>
  );
}

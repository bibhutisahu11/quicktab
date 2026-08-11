export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import FeedbackDashboard from "@/components/FeedbackDashboard";

export default async function FeedbackPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/admin");
  return <FeedbackDashboard />;
}

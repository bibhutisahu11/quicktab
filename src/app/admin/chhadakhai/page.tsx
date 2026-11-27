export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import ChhadakhaiManager from "@/components/ChhadakhaiManager";

export default async function ChhadakhaiAdminPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/admin");
  return <ChhadakhaiManager />;
}

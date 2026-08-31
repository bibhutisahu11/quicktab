export const dynamic = "force-dynamic";
import CashDrawerWidget from "@/components/CashDrawerWidget";

export const metadata = {
  title: "Cash Drawer | Admin",
};

export default function CashDrawerPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-6">
      <CashDrawerWidget />
    </div>
  );
}

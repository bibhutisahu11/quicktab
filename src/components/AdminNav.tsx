"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useState } from "react";

const ALL_LINKS = [
  { href: "/admin/dashboard",    label: "Dashboard",    icon: "📋", roles: ["HOTEL_ADMIN", "MANAGER"] },
  { href: "/admin/kitchen",      label: "Kitchen",      icon: "🍳", roles: ["KITCHEN", "HOTEL_ADMIN", "MANAGER"] },
  { href: "/admin/orders",       label: "Orders",       icon: "🤵", roles: ["WAITER", "HOTEL_ADMIN", "MANAGER"] },
  { href: "/admin/pre-orders",   label: "Pre-Orders",   icon: "🎁", roles: ["HOTEL_ADMIN", "MANAGER"] },
  { href: "/admin/new-order",    label: "New Order",    icon: "➕", roles: ["BILLER"] },
  { href: "/admin/orders",       label: "Transactions", icon: "🧾", roles: ["BILLER"] },
  { href: "/admin/cash-drawer",  label: "Cash Drawer",  icon: "💵", roles: ["BILLER", "HOTEL_ADMIN", "MANAGER"] },
  { href: "/admin/table-view",   label: "Table View",   icon: "🪑", roles: ["HOTEL_ADMIN", "MANAGER", "WAITER", "BILLER"] },
  { href: "/admin/analytics",    label: "Analytics",    icon: "📊", roles: ["HOTEL_ADMIN", "MANAGER"] },
  { href: "/admin/customers",    label: "Customers",    icon: "👥", roles: ["HOTEL_ADMIN", "MANAGER"] },
  { href: "/admin/menu",         label: "Menu",         icon: "🍴", roles: ["HOTEL_ADMIN", "BILLER"] },
  { href: "/admin/tables",       label: "Tables & QR",  icon: "📱", roles: ["HOTEL_ADMIN"] },
  { href: "/admin/staff",        label: "Staff",        icon: "👔", roles: ["HOTEL_ADMIN", "MANAGER"] },
  { href: "/admin/attendance",   label: "Attendance",   icon: "🗓️", roles: ["HOTEL_ADMIN", "MANAGER", "BILLER"] },
  { href: "/admin/inventory",    label: "Inventory",    icon: "📦", roles: ["HOTEL_ADMIN", "MANAGER"] },
  { href: "/admin/expenses",     label: "Expenses",     icon: "💰", roles: ["HOTEL_ADMIN", "MANAGER"] },
  { href: "/admin/advance",      label: "Advances",     icon: "💸", roles: ["HOTEL_ADMIN", "MANAGER", "BILLER"] },
  { href: "/admin/discounts",    label: "Discounts",    icon: "🏷️",  roles: ["HOTEL_ADMIN", "MANAGER"] },
  { href: "/admin/mess",         label: "Mess",         icon: "🍽️", roles: ["HOTEL_ADMIN", "MANAGER", "BILLER"] },
  { href: "/admin/feedback",     label: "Feedback",     icon: "💬", roles: ["HOTEL_ADMIN", "MANAGER", "BILLER"] },
  { href: "/admin/settings",     label: "Settings",     icon: "⚙️", roles: ["HOTEL_ADMIN"] },
];

const ROLE_LABELS: Record<string, string> = {
  HOTEL_ADMIN: "Hotel Admin",
  MANAGER: "Manager",
  WAITER: "Waiter",
  KITCHEN: "Kitchen",
  BILLER: "Biller",
  SUPER_ADMIN: "Super Admin",
};

function SidebarInner({
  orgName,
  orgLogo,
  initialRole,
  onNavClick,
}: {
  orgName: string | null;
  orgLogo?: string | null;
  initialRole?: string | null;
  onNavClick?: () => void;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  // Use server-provided role immediately, fall back to client session once loaded
  const role = session?.user?.role ?? initialRole ?? null;
  const visibleLinks = role ? ALL_LINKS.filter((l) => l.roles.includes(role)) : [];

  return (
    <div className="flex flex-col h-full">
      {/* Brand / Org */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-700/60">
        {orgLogo ? (
          <Image
            src={orgLogo}
            alt="logo"
            width={40}
            height={40}
            className="rounded-xl object-contain bg-white p-0.5 flex-shrink-0"
            unoptimized={orgLogo.startsWith("data:")}
          />
        ) : (
          <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center flex-shrink-0 shadow-md">
            <span className="text-white font-black text-sm tracking-tight">OT</span>
          </div>
        )}
        <div className="min-w-0">
          <div className="font-bold text-amber-400 text-sm leading-snug truncate">
            {orgName ?? session?.user?.orgName ?? "Admin"}
          </div>
          <div className="text-slate-500 text-xs">OrderTab</div>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {visibleLinks.map((link) => {
          const active = pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={onNavClick}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active
                  ? "bg-amber-500 text-white shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-slate-700/50"
              }`}
            >
              <span className="w-5 text-center text-base leading-none">{link.icon}</span>
              <span className="flex-1">{link.label}</span>
              {active && <div className="w-1.5 h-1.5 rounded-full bg-white/70 flex-shrink-0" />}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="px-3 py-3 border-t border-slate-700/60 space-y-1">
        <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg">
          <div className="w-7 h-7 rounded-full bg-slate-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
            {(session?.user?.name?.[0] ?? "A").toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-white text-xs font-medium truncate">{session?.user?.name ?? "Admin"}</div>
            <div className="text-slate-500 text-xs">{role ? (ROLE_LABELS[role] ?? role) : ""}</div>
          </div>
        </div>
        <button
          onClick={async () => {
            await signOut({ redirect: false });
            window.location.href = "/admin";
          }}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 text-sm transition-all"
        >
          <span className="w-5 text-center text-base leading-none">🚪</span>
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );
}

export default function AdminNav({
  orgName,
  orgLogo,
  initialRole,
}: {
  orgName: string | null;
  orgLogo?: string | null;
  initialRole?: string | null;
}) {
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex flex-col fixed inset-y-0 left-0 w-56 bg-slate-900 z-30 shadow-xl">
        <SidebarInner orgName={orgName} orgLogo={orgLogo} initialRole={initialRole} />
      </aside>

      {/* ── Mobile top bar ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-slate-900 z-30 flex items-center justify-between px-4 shadow-lg">
        <div className="flex items-center gap-2.5">
          {orgLogo ? (
            <Image
              src={orgLogo}
              alt="logo"
              width={32}
              height={32}
              className="rounded-lg object-contain bg-white p-0.5"
              unoptimized={orgLogo.startsWith("data:")}
            />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
              <span className="text-white font-black text-xs">OT</span>
            </div>
          )}
          <span className="text-amber-400 font-bold text-sm truncate max-w-[160px]">
            {orgName ?? session?.user?.orgName ?? "Admin"}
          </span>
        </div>
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="text-slate-300 hover:text-white p-1 rounded-lg hover:bg-slate-700/50 transition-colors"
          aria-label="Toggle menu"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {mobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* ── Mobile sidebar overlay ── */}
      {mobileOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="md:hidden fixed inset-y-0 left-0 w-64 bg-slate-900 z-50 shadow-2xl">
            <div className="pt-14 h-full">
              <SidebarInner orgName={orgName} orgLogo={orgLogo} initialRole={initialRole} onNavClick={() => setMobileOpen(false)} />
            </div>
          </aside>
        </>
      )}
    </>
  );
}

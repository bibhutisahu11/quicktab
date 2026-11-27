"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

interface ReminderState {
  lunchMissed: boolean;
  dinnerMissed: boolean;
}

const DISMISSED_KEY = "messReminderDismissed"; // sessionStorage key

export default function MessReminderBanner() {
  const { data: session } = useSession();
  const [reminder, setReminder]     = useState<ReminderState | null>(null);
  const [dismissed, setDismissed]   = useState<{ lunch: boolean; dinner: boolean }>({ lunch: false, dinner: false });

  // Only show for roles that handle mess
  const role = session?.user?.role;
  const eligible = role === "BILLER" || role === "HOTEL_ADMIN" || role === "MANAGER";

  useEffect(() => {
    if (!eligible) return;

    // Load dismissed state from sessionStorage (resets on tab close)
    try {
      const raw = sessionStorage.getItem(DISMISSED_KEY);
      if (raw) setDismissed(JSON.parse(raw));
    } catch { /* ignore */ }

    async function check() {
      try {
        const res = await fetch("/api/admin/mess-reminder");
        if (res.ok) setReminder(await res.json());
      } catch { /* ignore */ }
    }

    check();
    // Re-check every 15 minutes so the banner appears as time passes
    const interval = setInterval(check, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [eligible]);

  function dismiss(meal: "lunch" | "dinner") {
    const next = { ...dismissed, [meal]: true };
    setDismissed(next);
    try { sessionStorage.setItem(DISMISSED_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }

  if (!eligible || !reminder) return null;

  const showLunch  = reminder.lunchMissed  && !dismissed.lunch;
  const showDinner = reminder.dinnerMissed && !dismissed.dinner;
  if (!showLunch && !showDinner) return null;

  return (
    <div className="fixed top-14 md:top-0 md:left-56 right-0 z-40 pointer-events-none">
      <div className="max-w-2xl mx-auto md:mx-0 px-3 pt-2 space-y-2 pointer-events-auto">

        {showLunch && (
          <div className="flex items-center gap-3 bg-yellow-50 border border-yellow-300 rounded-xl px-4 py-3 shadow-md">
            <span className="text-2xl flex-shrink-0">☀️</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-yellow-800">Lunch attendance not marked!</p>
              <p className="text-xs text-yellow-600">It&apos;s past 1 PM — please mark today&apos;s lunch for mess customers.</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link
                href="/admin/mess"
                onClick={() => dismiss("lunch")}
                className="bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
              >
                Mark Now →
              </Link>
              <button
                onClick={() => dismiss("lunch")}
                className="text-yellow-400 hover:text-yellow-600 text-lg leading-none font-bold"
              >×</button>
            </div>
          </div>
        )}

        {showDinner && (
          <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-300 rounded-xl px-4 py-3 shadow-md">
            <span className="text-2xl flex-shrink-0">🌙</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-indigo-800">Dinner attendance not marked!</p>
              <p className="text-xs text-indigo-600">It&apos;s past 8 PM — please mark today&apos;s dinner for mess customers.</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link
                href="/admin/mess"
                onClick={() => dismiss("dinner")}
                className="bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
              >
                Mark Now →
              </Link>
              <button
                onClick={() => dismiss("dinner")}
                className="text-indigo-400 hover:text-indigo-600 text-lg leading-none font-bold"
              >×</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

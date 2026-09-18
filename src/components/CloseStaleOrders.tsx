"use client";

import { useEffect } from "react";

/**
 * Invisible component — on mount, silently calls /api/orders/close-stale
 * at most once per calendar day (tracked in localStorage).
 */
export default function CloseStaleOrders() {
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const key = "stale_closed_on";
    if (localStorage.getItem(key) === today) return; // already ran today

    fetch("/api/orders/close-stale", { method: "POST" })
      .then((r) => r.json())
      .then(({ closed }) => {
        if (closed > 0) console.info(`[CloseStale] Auto-closed ${closed} stale order(s) from previous day(s).`);
        localStorage.setItem(key, today);
      })
      .catch(() => {/* silent */});
  }, []);

  return null;
}

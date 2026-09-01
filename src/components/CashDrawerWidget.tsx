"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";

interface DrawerData {
  id?: string;
  openingBalance: number;
  notes?: string | null;
  date: string;
}

interface ApiResponse {
  drawer: DrawerData | null;
  cashFromOrders: number;
  date: string;
}

function fmt(amount: number) {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function CashDrawerWidget() {
  const today = new Date().toISOString().slice(0, 10);
  const { data: session } = useSession();
  const isAdmin = ["HOTEL_ADMIN", "MANAGER", "SUPER_ADMIN"].includes(session?.user?.role ?? "");

  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [openingInput, setOpeningInput] = useState("");
  const [notesInput, setNotesInput] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cash-drawer");
      if (!res.ok) throw new Error("Failed to load cash drawer data");
      const json: ApiResponse = await res.json();
      setData(json);
      setOpeningInput(String(json.drawer?.openingBalance ?? 0));
      setNotesInput(json.drawer?.notes ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/cash-drawer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openingBalance: parseFloat(openingInput) || 0,
          notes: notesInput.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      await fetchData();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function handleWhatsApp() {
    if (!data) return;
    const opening = data.drawer?.openingBalance ?? 0;
    const fromOrders = data.cashFromOrders;
    const total = opening + fromOrders;
    const notes = data.drawer?.notes;

    const displayDate = new Date(today + "T00:00:00").toLocaleDateString("en-IN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const lines = [
      `💰 Cash Drawer Summary — ${displayDate}`,
      ``,
      `Opening Balance: ${fmt(opening)}`,
      `Cash from Orders: ${fmt(fromOrders)}`,
      `─────────────────`,
      `Total in Drawer: ${fmt(total)}`,
      ...(notes ? [`Notes: ${notes}`] : []),
    ];

    const text = encodeURIComponent(lines.join("\n"));
    window.open(`https://wa.me/?text=${text}`, "_blank");
  }

  const opening = data?.drawer?.openingBalance ?? 0;
  const fromOrders = data?.cashFromOrders ?? 0;
  const total = opening + fromOrders;

  const displayDate = new Date(today + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="max-w-lg mx-auto space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">💵 Cash Drawer</h1>
          <p className="text-sm text-slate-500 mt-0.5">{displayDate}</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="text-slate-400 hover:text-slate-700 transition-colors p-1.5 rounded-lg hover:bg-slate-100"
          title="Refresh"
        >
          <svg className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Opening Balance</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">
            {loading ? <span className="animate-pulse text-slate-300">—</span> : fmt(opening)}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Cash from Orders</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">
            {loading ? <span className="animate-pulse text-slate-300">—</span> : fmt(fromOrders)}
          </p>
        </div>
      </div>

      {/* Total */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-emerald-700">Total in Drawer</p>
          <p className="text-sm text-emerald-600 mt-0.5">Opening + Cash orders</p>
        </div>
        <p className="text-3xl font-black text-emerald-600">
          {loading ? <span className="animate-pulse text-emerald-200">—</span> : fmt(total)}
        </p>
      </div>

      {/* Opening balance — set-once for BILLER, always editable for admin */}
      {data?.drawer && !isAdmin ? (
        // Already set today and user is BILLER — show locked read-only view
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Opening Balance — Locked</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{fmt(data.drawer.openingBalance)}</p>
              {data.drawer.notes && (
                <p className="text-sm text-slate-500 mt-1">📝 {data.drawer.notes}</p>
              )}
            </div>
            <span className="text-3xl">🔒</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">Opening balance was set for today. Only an admin can change it.</p>
        </div>
      ) : (
        // Not yet set, OR user is admin (can always edit)
        <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-5 space-y-4">
          <h2 className="text-sm font-semibold text-amber-700">
            {isAdmin && data?.drawer ? "✏️ Edit Opening Balance (Admin)" : "⚠️ Set Today's Opening Balance"}
          </h2>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Opening Cash (₹)
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                step="0.01"
                value={openingInput}
                onChange={(e) => setOpeningInput(e.target.value)}
                className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                placeholder="0.00"
              />
              <button
                onClick={handleSave}
                disabled={saving || loading}
                className="bg-amber-500 hover:bg-amber-600 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Saving…" : success ? "✓ Saved" : "Set"}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Notes (optional)
            </label>
            <textarea
              rows={2}
              value={notesInput}
              onChange={(e) => setNotesInput(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-none"
              placeholder="e.g. gave ₹200 change to table 3"
            />
          </div>
          {!isAdmin && <p className="text-xs text-amber-600">⚠️ This can only be set once per day.</p>}
        </div>
      )}

      {/* WhatsApp share */}
      <button
        onClick={handleWhatsApp}
        disabled={loading || !data}
        className="w-full flex items-center justify-center gap-2.5 bg-green-500 hover:bg-green-600 text-white font-semibold py-3.5 rounded-2xl text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
        Share Summary on WhatsApp
      </button>
    </div>
  );
}

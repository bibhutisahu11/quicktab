"use client";

import { useEffect, useState } from "react";

interface Booking {
  id: string;
  name: string;
  phone: string;
  persons: number;
  visitDate: string;
  visitTime: string;
  status: string;
  createdAt: string;
}

const DATE_LABELS: Record<string, string> = {
  "2026-11-28": "28 Nov (Sat)",
  "2026-11-29": "29 Nov (Sun)",
};

export default function ChhadakhaiManager() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filterDate, setFilterDate] = useState<string>("all");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/chhadakhai");
    if (res.ok) setBookings(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function updateStatus(id: string, status: string) {
    await fetch("/api/chhadakhai", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    load();
  }

  const filtered = filterDate === "all" ? bookings : bookings.filter(b => b.visitDate === filterDate);
  const totalPersons = filtered.reduce((s, b) => s + b.persons, 0);
  const confirmed = filtered.filter(b => b.status === "CONFIRMED").length;
  const cancelled = filtered.filter(b => b.status === "CANCELLED").length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl px-6 py-5 text-white">
        <h1 className="text-2xl font-black">🎊 Chhadakhai Bookings</h1>
        <p className="text-amber-100 text-sm mt-1">28th & 29th November 2026 · Kalinga Bites</p>
        <div className="flex gap-4 mt-3 text-sm font-semibold">
          <span className="bg-white/20 rounded-lg px-3 py-1">Total: {filtered.length} bookings</span>
          <span className="bg-white/20 rounded-lg px-3 py-1">👥 {totalPersons} persons</span>
          <span className="bg-green-500/40 rounded-lg px-3 py-1">✅ {confirmed} confirmed</span>
          {cancelled > 0 && <span className="bg-red-500/40 rounded-lg px-3 py-1">❌ {cancelled} cancelled</span>}
        </div>
      </div>

      {/* Public link */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-amber-800">📋 Public Booking Link</p>
          <p className="text-xs text-amber-600 mt-0.5 font-mono">ordertab.vercel.app/kalinga-bites/chhadakhai</p>
        </div>
        <button
          onClick={() => { navigator.clipboard.writeText("https://ordertab.vercel.app/kalinga-bites/chhadakhai"); }}
          className="bg-amber-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-amber-600 transition-colors whitespace-nowrap"
        >
          Copy Link
        </button>
      </div>

      {/* Date filter */}
      <div className="flex gap-2">
        {["all", "2026-11-28", "2026-11-29"].map((d) => (
          <button
            key={d}
            onClick={() => setFilterDate(d)}
            className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
              filterDate === d ? "bg-amber-500 text-white" : "bg-white border border-slate-200 text-slate-600 hover:border-amber-300"
            }`}
          >
            {d === "all" ? "All Dates" : DATE_LABELS[d]}
          </button>
        ))}
      </div>

      {/* Bookings list */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading bookings…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400">No bookings yet for this date.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((b, i) => (
            <div key={b.id} className={`bg-white border rounded-2xl px-4 py-4 shadow-sm flex items-center gap-4 ${b.status === "CANCELLED" ? "opacity-60" : ""}`}>
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-sm font-black text-amber-700 flex-shrink-0">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-slate-800">{b.name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                    b.status === "CONFIRMED" ? "bg-green-100 text-green-700" :
                    b.status === "ARRIVED"   ? "bg-blue-100 text-blue-700" :
                    "bg-red-100 text-red-600"
                  }`}>
                    {b.status === "CONFIRMED" ? "✅ Confirmed" : b.status === "ARRIVED" ? "🏃 Arrived" : "❌ Cancelled"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-slate-500">
                  <span>📱 {b.phone}</span>
                  <span>👥 {b.persons} person{b.persons > 1 ? "s" : ""}</span>
                  <span>📅 {DATE_LABELS[b.visitDate]}</span>
                  <span>🕐 {b.visitTime}</span>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {b.status !== "ARRIVED" && b.status !== "CANCELLED" && (
                  <button onClick={() => updateStatus(b.id, "ARRIVED")}
                    className="bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                    Arrived
                  </button>
                )}
                {b.status !== "CANCELLED" && (
                  <button onClick={() => updateStatus(b.id, "CANCELLED")}
                    className="bg-red-100 hover:bg-red-200 text-red-600 text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors">
                    Cancel
                  </button>
                )}
                {b.status === "CANCELLED" && (
                  <button onClick={() => updateStatus(b.id, "CONFIRMED")}
                    className="bg-green-100 hover:bg-green-200 text-green-700 text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors">
                    Restore
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

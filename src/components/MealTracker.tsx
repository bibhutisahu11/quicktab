"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";

interface RegularCustomer {
  id: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  active: boolean;
  rateBreakfast?: number | null;
  rateLunch?: number | null;
  rateDinner?: number | null;
}

interface MealEntry {
  id: string;
  customerId: string;
  date: string;
  breakfast: boolean;
  lunch: boolean;
  dinner: boolean;
  notes?: string | null;
}

const MEAL_TYPES = ["breakfast", "lunch", "dinner"] as const;
type MealType = typeof MEAL_TYPES[number];

const MEAL_LABELS: Record<MealType, { label: string; short: string; emoji: string; color: string; bg: string; border: string }> = {
  breakfast: { label: "Breakfast", short: "B", emoji: "🌅", color: "text-orange-700", bg: "bg-orange-100", border: "border-orange-400" },
  lunch:     { label: "Lunch",     short: "L", emoji: "☀️",  color: "text-yellow-700", bg: "bg-yellow-100", border: "border-yellow-400" },
  dinner:    { label: "Dinner",    short: "D", emoji: "🌙", color: "text-indigo-700",  bg: "bg-indigo-100",  border: "border-indigo-400"  },
};

const INPUT_CLS = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400";
const SELECT_CLS = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400";

function todayStr() { return new Date().toISOString().slice(0, 10); }
function currentMonthStr() { return new Date().toISOString().slice(0, 7); }
function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function getDaysInMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const days = new Date(y, m, 0).getDate();
  return Array.from({ length: days }, (_, i) => `${ym}-${String(i + 1).padStart(2, "0")}`);
}

const DEFAULT_RATES: Record<MealType, number> = { breakfast: 50, lunch: 80, dinner: 80 };

export default function MealTracker() {
  const { data: session } = useSession();
  const orgName = session?.user?.orgName ?? "";
  const isAdmin = ["HOTEL_ADMIN", "MANAGER", "SUPER_ADMIN"].includes(session?.user?.role ?? "");

  const [tab, setTab] = useState<"today" | "customers" | "summary">("today");
  const [customers, setCustomers] = useState<RegularCustomer[]>([]);
  const [entries, setEntries] = useState<MealEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Today tab
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Summary tab
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr());
  const [summaryEntries, setSummaryEntries] = useState<MealEntry[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  // Per-meal rates (editable by admin)
  const [rates, setRates] = useState<Record<MealType, number>>(DEFAULT_RATES);

  // Customers tab
  const [showForm, setShowForm] = useState(false);
  const [editCustomer, setEditCustomer] = useState<RegularCustomer | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", address: "", notes: "", rateBreakfast: "", rateLunch: "", rateDinner: "" });
  const [saving, setSaving] = useState(false);

  const loadTodayData = useCallback(async (date: string) => {
    setLoading(true);
    const [cRes, eRes] = await Promise.all([
      fetch("/api/regular-customers"),
      fetch(`/api/meal-entries?date=${date}`),
    ]);
    if (cRes.ok) setCustomers(await cRes.json());
    if (eRes.ok) setEntries(await eRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { loadTodayData(selectedDate); }, [selectedDate, loadTodayData]);

  const loadSummary = useCallback(async (month: string) => {
    setSummaryLoading(true);
    const res = await fetch(`/api/meal-entries?month=${month}`);
    if (res.ok) setSummaryEntries(await res.json());
    setSummaryLoading(false);
  }, []);

  useEffect(() => {
    if (tab === "summary") loadSummary(selectedMonth);
  }, [tab, selectedMonth, loadSummary]);

  function getEntry(customerId: string) {
    return entries.find((e) => e.customerId === customerId);
  }

  async function toggleMeal(customer: RegularCustomer, meal: MealType) {
    const key = `${customer.id}-${meal}`;
    setSavingKey(key);
    const existing = getEntry(customer.id);
    const newVal = !(existing?.[meal] ?? false);
    const payload = {
      customerId: customer.id,
      date: selectedDate,
      breakfast: existing?.breakfast ?? false,
      lunch:     existing?.lunch     ?? false,
      dinner:    existing?.dinner    ?? false,
      [meal]: newVal,
    };
    const res = await fetch("/api/meal-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const updated: MealEntry = await res.json();
      setEntries((prev) => {
        const exists = prev.find((e) => e.customerId === customer.id);
        if (exists) return prev.map((e) => e.customerId === customer.id ? updated : e);
        return [...prev, updated];
      });
    }
    setSavingKey(null);
  }

  // ── Summary helpers ──────────────────────────────────────────────────────────
  const summaryByCustomer = useMemo(() => {
    const days = getDaysInMonth(selectedMonth);
    return customers.filter((c) => c.active).map((c) => {
      const myEntries = summaryEntries.filter((e) => e.customerId === c.id);
      const counts = { breakfast: 0, lunch: 0, dinner: 0 };
      for (const e of myEntries) {
        if (e.breakfast) counts.breakfast++;
        if (e.lunch) counts.lunch++;
        if (e.dinner) counts.dinner++;
      }
      const rB = c.rateBreakfast ?? rates.breakfast;
      const rL = c.rateLunch    ?? rates.lunch;
      const rD = c.rateDinner   ?? rates.dinner;
      const total = counts.breakfast * rB + counts.lunch * rL + counts.dinner * rD;
      const daysPresent = myEntries.filter((e) => e.breakfast || e.lunch || e.dinner).length;
      return { customer: c, counts, total, daysPresent, totalDays: days.length };
    });
  }, [customers, summaryEntries, selectedMonth, rates]);

  function sendWhatsAppSummary(row: typeof summaryByCustomer[0]) {
    const { customer: c, counts, total } = row;
    const rawPhone = (c.phone ?? "").replace(/\D/g, "");
    const to = rawPhone ? `91${rawPhone.replace(/^91/, "")}` : "";
    const [y, m] = selectedMonth.split("-");
    const monthLabel = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    const rB = c.rateBreakfast ?? rates.breakfast;
    const rL = c.rateLunch    ?? rates.lunch;
    const rD = c.rateDinner   ?? rates.dinner;

    const lines = [
      `🍽️ *Monthly Meal Bill*`,
      ``,
      `Hi *${c.name}*,`,
      `Here is your meal summary for *${monthLabel}*:`,
      ``,
      counts.breakfast > 0 ? `  🌅 Breakfast: ${counts.breakfast} days × ₹${rB} = ₹${(counts.breakfast * rB).toFixed(0)}` : "",
      counts.lunch     > 0 ? `  ☀️ Lunch:     ${counts.lunch}     days × ₹${rL} = ₹${(counts.lunch * rL).toFixed(0)}`     : "",
      counts.dinner    > 0 ? `  🌙 Dinner:    ${counts.dinner}    days × ₹${rD} = ₹${(counts.dinner * rD).toFixed(0)}`    : "",
      ``,
      `──────────────────`,
      `*Total: ₹${total.toFixed(0)}*`,
      `──────────────────`,
      ``,
      `Please pay at your earliest convenience. Thank you! 🙏`,
      orgName ? `— *${orgName}*` : "",
    ].filter(Boolean).join("\n").trim();

    const url = to
      ? `https://wa.me/${to}?text=${encodeURIComponent(lines)}`
      : `https://wa.me/?text=${encodeURIComponent(lines)}`;
    window.open(url, "_blank");
  }

  // ── Customer form ────────────────────────────────────────────────────────────
  function openAdd() {
    setEditCustomer(null);
    setForm({ name: "", phone: "", address: "", notes: "", rateBreakfast: "", rateLunch: "", rateDinner: "" });
    setShowForm(true);
  }
  function openEdit(c: RegularCustomer) {
    setEditCustomer(c);
    setForm({
      name: c.name, phone: c.phone ?? "", address: c.address ?? "",
      notes: c.notes ?? "",
      rateBreakfast: c.rateBreakfast != null ? String(c.rateBreakfast) : "",
      rateLunch:     c.rateLunch     != null ? String(c.rateLunch)     : "",
      rateDinner:    c.rateDinner    != null ? String(c.rateDinner)    : "",
    });
    setShowForm(true);
  }
  async function saveCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      phone: form.phone || null,
      address: form.address || null,
      notes: form.notes || null,
      rateBreakfast: form.rateBreakfast || null,
      rateLunch:     form.rateLunch     || null,
      rateDinner:    form.rateDinner    || null,
    };
    if (editCustomer) {
      await fetch(`/api/regular-customers/${editCustomer.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    } else {
      await fetch("/api/regular-customers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    }
    setSaving(false);
    setShowForm(false);
    loadTodayData(selectedDate);
  }
  async function toggleActive(c: RegularCustomer) {
    await fetch(`/api/regular-customers/${c.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !c.active }) });
    loadTodayData(selectedDate);
  }
  async function deleteCustomer(c: RegularCustomer) {
    if (!confirm(`Delete ${c.name}? All their meal records will also be deleted.`)) return;
    await fetch(`/api/regular-customers/${c.id}`, { method: "DELETE" });
    loadTodayData(selectedDate);
  }

  // ── Today summary ────────────────────────────────────────────────────────────
  const todayCounts = useMemo(() => {
    const counts = { breakfast: 0, lunch: 0, dinner: 0, total: 0 };
    for (const e of entries) {
      if (e.breakfast) counts.breakfast++;
      if (e.lunch)     counts.lunch++;
      if (e.dinner)    counts.dinner++;
    }
    counts.total = counts.breakfast + counts.lunch + counts.dinner;
    return counts;
  }, [entries]);

  const activeCustomers = customers.filter((c) => c.active);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Mess / Regular Customers</h2>
          <p className="text-slate-500 text-sm mt-0.5">Track daily meals & generate monthly bills for regular customers</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {([
          { id: "today",     label: "📅 Today" },
          { id: "summary",   label: "📊 Monthly Bill" },
          { id: "customers", label: "👥 Customers" },
        ] as const).map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === t.id ? "bg-white text-slate-800 shadow" : "text-slate-500 hover:text-slate-700"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TODAY TAB ──────────────────────────────────────────────────────────── */}
      {tab === "today" && (
        <div className="space-y-4">
          {/* Date picker */}
          <div className="flex items-center gap-3 flex-wrap">
            <input type="date" value={selectedDate} max={todayStr()}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border border-slate-300 rounded-xl px-3 py-2 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <span className="text-slate-500 text-sm">{fmtDate(selectedDate)}</span>
            {selectedDate !== todayStr() && (
              <button onClick={() => setSelectedDate(todayStr())} className="text-amber-600 text-xs font-bold hover:underline">Today</button>
            )}
          </div>

          {/* Summary pills */}
          {activeCustomers.length > 0 && (
            <div className="flex gap-3 flex-wrap">
              {MEAL_TYPES.map((m) => {
                const cfg = MEAL_LABELS[m];
                return (
                  <div key={m} className={`${cfg.bg} ${cfg.border} border rounded-xl px-4 py-2 flex items-center gap-2`}>
                    <span className="text-lg">{cfg.emoji}</span>
                    <div>
                      <p className="text-xs font-semibold text-slate-500">{cfg.label}</p>
                      <p className={`text-lg font-black ${cfg.color}`}>{todayCounts[m]}</p>
                    </div>
                  </div>
                );
              })}
              <div className="bg-slate-100 border border-slate-200 rounded-xl px-4 py-2 flex items-center gap-2">
                <span className="text-lg">🍽️</span>
                <div>
                  <p className="text-xs font-semibold text-slate-500">Total Meals</p>
                  <p className="text-lg font-black text-slate-800">{todayCounts.total}</p>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-16 text-slate-400"><div className="text-4xl animate-pulse mb-3">🍽️</div><p>Loading…</p></div>
          ) : activeCustomers.length === 0 ? (
            <div className="text-center py-16 bg-slate-50 rounded-2xl text-slate-400">
              <div className="text-4xl mb-3">👥</div>
              <p className="font-semibold">No active customers</p>
              <p className="text-sm mt-1">Add customers in the Customers tab first</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activeCustomers.map((c) => {
                const entry = getEntry(c.id);
                const hasMeal = entry?.breakfast || entry?.lunch || entry?.dinner;
                return (
                  <div key={c.id} className={`bg-white border-2 rounded-2xl p-4 shadow-sm transition-all ${hasMeal ? "border-amber-300" : "border-slate-200"}`}>
                    <div className="flex items-center gap-3 flex-wrap">
                      {/* Avatar */}
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center font-black text-lg flex-shrink-0 ${hasMeal ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-400"}`}>
                        {c.name[0].toUpperCase()}
                      </div>
                      {/* Name */}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-800 text-sm">{c.name}</p>
                        {c.phone && <p className="text-xs text-slate-400">{c.phone}</p>}
                      </div>
                      {/* Meal toggles */}
                      <div className="flex gap-2 flex-wrap">
                        {MEAL_TYPES.map((meal) => {
                          const cfg = MEAL_LABELS[meal];
                          const active = entry?.[meal] ?? false;
                          const isLoading = savingKey === `${c.id}-${meal}`;
                          return (
                            <button
                              key={meal}
                              onClick={() => toggleMeal(c, meal)}
                              disabled={!!savingKey}
                              title={cfg.label}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all ${
                                active
                                  ? `${cfg.bg} ${cfg.color} ${cfg.border} shadow-sm`
                                  : "bg-white text-slate-400 border-slate-200 hover:border-slate-400"
                              }`}
                            >
                              {isLoading ? "…" : cfg.emoji} {cfg.short}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── MONTHLY SUMMARY TAB ───────────────────────────────────────────────── */}
      {tab === "summary" && (
        <div className="space-y-5">
          {/* Controls */}
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Month</label>
              <input type="month" value={selectedMonth} max={currentMonthStr()}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="border border-slate-300 rounded-xl px-3 py-2 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            {isAdmin && (
              <div className="flex gap-3 flex-wrap">
                {MEAL_TYPES.map((m) => {
                  const cfg = MEAL_LABELS[m];
                  return (
                    <div key={m}>
                      <label className={`block text-xs font-bold uppercase tracking-wide mb-1 ${cfg.color}`}>{cfg.emoji} {cfg.label} Rate (₹)</label>
                      <input type="number" min="0" value={rates[m]}
                        onChange={(e) => setRates((r) => ({ ...r, [m]: parseFloat(e.target.value) || 0 }))}
                        className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 w-24 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {summaryLoading ? (
            <div className="text-center py-16 text-slate-400"><div className="text-4xl animate-pulse mb-3">📊</div><p>Loading…</p></div>
          ) : summaryByCustomer.length === 0 ? (
            <div className="text-center py-16 bg-slate-50 rounded-2xl text-slate-400">
              <div className="text-4xl mb-3">📋</div>
              <p className="font-semibold">No customers or no meal entries for this month</p>
            </div>
          ) : (
            <div className="space-y-3">
              {summaryByCustomer.map(({ customer: c, counts, total, daysPresent }) => (
                <div key={c.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-amber-100 flex items-center justify-center font-black text-amber-700 text-lg">
                        {c.name[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">{c.name}</p>
                        {c.phone && <p className="text-xs text-slate-400">{c.phone}</p>}
                        <p className="text-xs text-slate-400 mt-0.5">{daysPresent} visit days</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-black text-slate-800">₹{total.toFixed(0)}</span>
                      <button
                        onClick={() => sendWhatsAppSummary({ customer: c, counts, total, daysPresent, totalDays: getDaysInMonth(selectedMonth).length })}
                        title="Send bill via WhatsApp"
                        className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white font-bold px-3 py-1.5 rounded-xl text-xs transition-colors"
                      >
                        📲 Send Bill
                      </button>
                    </div>
                  </div>

                  {/* Meal breakdown */}
                  <div className="mt-4 flex flex-wrap gap-3">
                    {MEAL_TYPES.map((m) => {
                      const cfg = MEAL_LABELS[m];
                      const rateUsed = m === "breakfast" ? (c.rateBreakfast ?? rates.breakfast) : m === "lunch" ? (c.rateLunch ?? rates.lunch) : (c.rateDinner ?? rates.dinner);
                      if (counts[m] === 0) return null;
                      return (
                        <div key={m} className={`${cfg.bg} ${cfg.border} border rounded-xl px-3 py-2 text-center min-w-[90px]`}>
                          <p className="text-lg">{cfg.emoji}</p>
                          <p className={`text-xs font-bold ${cfg.color}`}>{cfg.label}</p>
                          <p className="text-sm font-black text-slate-800">{counts[m]} days</p>
                          <p className="text-xs text-slate-500">₹{(counts[m] * rateUsed).toFixed(0)}</p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Day-by-day strip */}
                  <div className="mt-4 flex flex-wrap gap-1">
                    {getDaysInMonth(selectedMonth).map((day) => {
                      const e = summaryEntries.find((x) => x.customerId === c.id && x.date === day);
                      const hasAny = e?.breakfast || e?.lunch || e?.dinner;
                      const dayNum = parseInt(day.slice(-2));
                      return (
                        <div key={day} title={`${fmtDate(day)}${e ? `: ${[e.breakfast && "B", e.lunch && "L", e.dinner && "D"].filter(Boolean).join("+")}` : ""}`}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold border ${
                            hasAny ? "bg-amber-100 border-amber-400 text-amber-700" : "bg-slate-50 border-slate-200 text-slate-300"
                          }`}
                        >
                          {dayNum}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Grand total */}
              <div className="bg-slate-800 text-white rounded-2xl p-5 flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Grand Total for {new Date(selectedMonth + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</p>
                  <p className="text-2xl font-black">₹{summaryByCustomer.reduce((s, r) => s + r.total, 0).toFixed(0)}</p>
                </div>
                <div className="text-right text-sm text-slate-400 space-y-0.5">
                  {MEAL_TYPES.map((m) => {
                    const cfg = MEAL_LABELS[m];
                    const tot = summaryByCustomer.reduce((s, r) => s + r.counts[m], 0);
                    return tot > 0 ? <p key={m}>{cfg.emoji} {cfg.label}: {tot} meals</p> : null;
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CUSTOMERS TAB ─────────────────────────────────────────────────────── */}
      {tab === "customers" && (
        <div className="space-y-4">
          {isAdmin && (
            <button onClick={openAdd}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors"
            >
              ➕ Add Regular Customer
            </button>
          )}

          {customers.length === 0 ? (
            <div className="text-center py-16 bg-slate-50 rounded-2xl text-slate-400">
              <div className="text-4xl mb-3">👥</div>
              <p className="font-semibold">No regular customers yet</p>
              {isAdmin && <p className="text-sm mt-1">Click "Add Regular Customer" to get started</p>}
            </div>
          ) : (
            <div className="space-y-3">
              {customers.map((c) => (
                <div key={c.id} className={`bg-white border-2 rounded-2xl p-4 shadow-sm ${c.active ? "border-slate-200" : "border-slate-100 opacity-60"}`}>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center font-black text-lg ${c.active ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-400"}`}>
                      {c.name[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-800">{c.name} {!c.active && <span className="text-xs text-slate-400 font-normal">(inactive)</span>}</p>
                      {c.phone   && <p className="text-xs text-slate-500">📱 {c.phone}</p>}
                      {c.address && <p className="text-xs text-slate-400">📍 {c.address}</p>}
                      {(c.rateBreakfast || c.rateLunch || c.rateDinner) && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          {[c.rateBreakfast && `🌅₹${c.rateBreakfast}`, c.rateLunch && `☀️₹${c.rateLunch}`, c.rateDinner && `🌙₹${c.rateDinner}`].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                    {isAdmin && (
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(c)} className="text-slate-400 hover:text-amber-600 transition-colors" title="Edit">✏️</button>
                        <button onClick={() => toggleActive(c)} title={c.active ? "Deactivate" : "Activate"}
                          className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-colors ${c.active ? "bg-red-50 text-red-500 hover:bg-red-100" : "bg-green-50 text-green-600 hover:bg-green-100"}`}
                        >
                          {c.active ? "Deactivate" : "Activate"}
                        </button>
                        <button onClick={() => deleteCustomer(c)} className="text-slate-400 hover:text-red-600 transition-colors" title="Delete">🗑️</button>
                      </div>
                    )}
                  </div>
                  {c.notes && <p className="text-xs text-slate-400 mt-2 italic pl-14">"{c.notes}"</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Add/Edit Customer Modal ───────────────────────────────────────────── */}
      {showForm && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-black text-slate-800 text-lg mb-5">{editCustomer ? "Edit Customer" : "Add Regular Customer"}</h3>
            <form onSubmit={saveCustomer} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Name *</label>
                <input type="text" required value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className={INPUT_CLS} placeholder="e.g. Ramesh Kumar" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Phone</label>
                  <input type="tel" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} className={INPUT_CLS} placeholder="10-digit" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Address</label>
                  <input type="text" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} className={INPUT_CLS} placeholder="Optional" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Custom Meal Rates (₹) <span className="font-normal text-slate-400">— leave blank to use default</span></label>
                <div className="grid grid-cols-3 gap-3">
                  {MEAL_TYPES.map((m) => {
                    const cfg = MEAL_LABELS[m];
                    const key = `rate${m.charAt(0).toUpperCase() + m.slice(1)}` as keyof typeof form;
                    return (
                      <div key={m}>
                        <label className={`block text-xs font-semibold mb-1 ${cfg.color}`}>{cfg.emoji} {cfg.label}</label>
                        <input type="number" min="0" value={form[key]}
                          onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                          placeholder={`₹${DEFAULT_RATES[m]}`}
                          className={INPUT_CLS}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Notes</label>
                <input type="text" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} className={INPUT_CLS} placeholder="Optional notes" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-slate-300 text-slate-600 font-semibold py-2.5 rounded-xl text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-black py-2.5 rounded-xl text-sm transition-colors">
                  {saving ? "Saving…" : editCustomer ? "Save Changes" : "Add Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

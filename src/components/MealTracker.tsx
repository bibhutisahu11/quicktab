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
  enableBreakfast: boolean;
  enableLunch: boolean;
  enableDinner: boolean;
  rateBreakfast?: number | null;
  rateLunch?: number | null;
  rateDinner?: number | null;
  billingStartDay?: number | null; // 1-28, default 1
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

interface MealPayment {
  id: string;
  customerId: string;
  month: string;
  paidOn: string;
  amount: number;
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

/** Returns the billing period for a customer given the selected "base" month */
function getBillingPeriod(billingStartDay: number, selectedMonth: string) {
  const startDay = billingStartDay && billingStartDay > 1 ? Math.min(billingStartDay, 28) : 1;
  const [y, m] = selectedMonth.split("-").map(Number);

  if (startDay === 1) {
    // Standard calendar month
    const days = getDaysInMonth(selectedMonth);
    return {
      from: days[0],
      to: days[days.length - 1],
      days,
      label: new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
    };
  }

  // Custom cycle: startDay of selectedMonth → (startDay-1) of next month
  const from = `${selectedMonth}-${String(startDay).padStart(2, "0")}`;
  const nextMonthDate = new Date(y, m, 1); // 1st of next month
  const ny = nextMonthDate.getFullYear();
  const nm = String(nextMonthDate.getMonth() + 1).padStart(2, "0");
  const to   = `${ny}-${nm}-${String(startDay - 1).padStart(2, "0")}`;

  // Generate every date in this window
  const days: string[] = [];
  let cur = new Date(from + "T00:00:00");
  const end = new Date(to + "T00:00:00");
  while (cur <= end) {
    days.push(cur.toISOString().slice(0, 10));
    cur = new Date(cur.getTime() + 86_400_000);
  }

  return {
    from,
    to,
    days,
    label: `${fmtDate(from)} – ${fmtDate(to)}`,
  };
}

/** Returns the "next month" string for a given YYYY-MM */
function nextMonthStr(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
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
  // Draft state — local edits before Save is clicked
  const [pendingEntries, setPendingEntries] = useState<Record<string, { breakfast: boolean; lunch: boolean; dinner: boolean }>>({});
  const [isSavingAll, setIsSavingAll] = useState(false);
  const hasPending = Object.keys(pendingEntries).length > 0;

  // Summary tab
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr());
  const [summaryEntries, setSummaryEntries] = useState<MealEntry[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [payments, setPayments] = useState<MealPayment[]>([]);
  // Per-meal rates (editable by admin)
  const [rates, setRates] = useState<Record<MealType, number>>(DEFAULT_RATES);
  // Pay modal state
  const [payModal, setPayModal] = useState<{ customerId: string; name: string; totalBill: number } | null>(null);
  const [payDate, setPayDate] = useState(todayStr());
  const [payAmountInput, setPayAmountInput] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [payingSaving, setPayingSaving] = useState(false);

  // Customers tab
  const [showForm, setShowForm] = useState(false);
  const [editCustomer, setEditCustomer] = useState<RegularCustomer | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", address: "", notes: "", rateBreakfast: "", rateLunch: "", rateDinner: "", billingStartDay: "1", enableBreakfast: true, enableLunch: true, enableDinner: true });
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

  useEffect(() => {
    setPendingEntries({});
    loadTodayData(selectedDate);
  }, [selectedDate, loadTodayData]);

  const loadSummary = useCallback(async (month: string) => {
    setSummaryLoading(true);
    const next = nextMonthStr(month);
    const [eRes, eRes2, pRes] = await Promise.all([
      fetch(`/api/meal-entries?month=${month}`),
      fetch(`/api/meal-entries?month=${next}`),   // needed for cycles that span two months
      fetch(`/api/meal-payments?month=${month}`),
    ]);
    const e1: MealEntry[] = eRes.ok  ? await eRes.json()  : [];
    const e2: MealEntry[] = eRes2.ok ? await eRes2.json() : [];
    setSummaryEntries([...e1, ...e2]);
    if (pRes.ok) setPayments(await pRes.json());
    setSummaryLoading(false);
  }, []);

  useEffect(() => {
    if (tab === "summary") loadSummary(selectedMonth);
  }, [tab, selectedMonth, loadSummary]);

  function getEntry(customerId: string) {
    return entries.find((e) => e.customerId === customerId);
  }

  /** Returns the current state for a customer — pending draft takes priority */
  function getEffectiveEntry(customerId: string) {
    const saved = entries.find((e) => e.customerId === customerId);
    const draft = pendingEntries[customerId];
    if (!draft) return saved;
    return {
      id: saved?.id ?? "",
      customerId,
      date: selectedDate,
      breakfast: draft.breakfast,
      lunch:     draft.lunch,
      dinner:    draft.dinner,
    };
  }

  function toggleMeal(customer: RegularCustomer, meal: MealType) {
    const effective = getEffectiveEntry(customer.id);
    const current = {
      breakfast: effective?.breakfast ?? false,
      lunch:     effective?.lunch     ?? false,
      dinner:    effective?.dinner    ?? false,
    };
    const updated = { ...current, [meal]: !current[meal as MealType] };
    setPendingEntries((prev) => ({ ...prev, [customer.id]: updated }));
  }

  function discardPending() {
    setPendingEntries({});
  }

  async function saveAllPending() {
    if (!hasPending) return;
    setIsSavingAll(true);
    const saves = Object.entries(pendingEntries).map(([customerId, meals]) =>
      fetch("/api/meal-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, date: selectedDate, ...meals }),
      }).then((r) => r.ok ? r.json() : null)
    );
    const results: (MealEntry | null)[] = await Promise.all(saves);
    setEntries((prev) => {
      let next = [...prev];
      for (const updated of results) {
        if (!updated) continue;
        const idx = next.findIndex((e) => e.customerId === updated.customerId);
        if (idx >= 0) next[idx] = updated;
        else next = [...next, updated];
      }
      return next;
    });
    setPendingEntries({});
    setIsSavingAll(false);
  }

  // ── Summary helpers ──────────────────────────────────────────────────────────
  const summaryByCustomer = useMemo(() => {
    return customers.filter((c) => c.active).map((c) => {
      const period = getBillingPeriod(c.billingStartDay ?? 1, selectedMonth);
      const myEntries = summaryEntries.filter(
        (e) => e.customerId === c.id && e.date >= period.from && e.date <= period.to
      );
      const counts = { breakfast: 0, lunch: 0, dinner: 0 };
      for (const e of myEntries) {
        // Only count a meal if it's enabled for this customer
        if (e.breakfast && c.enableBreakfast !== false) counts.breakfast++;
        if (e.lunch     && c.enableLunch     !== false) counts.lunch++;
        if (e.dinner    && c.enableDinner    !== false) counts.dinner++;
      }
      const rB = c.rateBreakfast ?? rates.breakfast;
      const rL = c.rateLunch    ?? rates.lunch;
      const rD = c.rateDinner   ?? rates.dinner;
      const total = counts.breakfast * rB + counts.lunch * rL + counts.dinner * rD;
      // Per-day rate = sum of enabled meal rates
      const dailyRate =
        (c.enableBreakfast !== false ? rB : 0) +
        (c.enableLunch     !== false ? rL : 0) +
        (c.enableDinner    !== false ? rD : 0);
      const daysPresent = myEntries.filter((e) => e.breakfast || e.lunch || e.dinner).length;
      return { customer: c, counts, total, daysPresent, period, dailyRate };
    });
  }, [customers, summaryEntries, selectedMonth, rates]);

  function sendWhatsAppSummary(row: typeof summaryByCustomer[0]) {
    const { customer: c, counts, total, period } = row;
    const rawPhone = (c.phone ?? "").replace(/\D/g, "");
    const to = rawPhone ? `91${rawPhone.replace(/^91/, "")}` : "";
    const monthLabel = period.label;
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

  // ── Payment helpers ──────────────────────────────────────────────────────────
  function openPayModal(customerId: string, name: string, totalBill: number) {
    const existing = payments.find((p) => p.customerId === customerId && p.month === selectedMonth);
    setPayModal({ customerId, name, totalBill });
    setPayDate(existing?.paidOn ?? todayStr());
    setPayAmountInput(existing ? String(existing.amount) : String(Math.round(totalBill)));
    setPayNotes(existing?.notes ?? "");
  }

  async function savePayment() {
    if (!payModal) return;
    const paid = parseFloat(payAmountInput);
    if (!paid || paid <= 0) return;
    setPayingSaving(true);
    await fetch("/api/meal-payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: payModal.customerId,
        month: selectedMonth,
        paidOn: payDate,
        amount: paid,
        notes: payNotes || null,
      }),
    });
    await loadSummary(selectedMonth);
    setPayModal(null);
    setPayingSaving(false);
  }

  async function unmarkPayment(customerId: string) {
    if (!confirm("Remove payment record for this customer?")) return;
    await fetch(`/api/meal-payments?customerId=${customerId}&month=${selectedMonth}`, { method: "DELETE" });
    await loadSummary(selectedMonth);
  }

  // ── Customer form ────────────────────────────────────────────────────────────
  function openAdd() {
    setEditCustomer(null);
    setForm({ name: "", phone: "", address: "", notes: "", rateBreakfast: "", rateLunch: "", rateDinner: "", billingStartDay: "1", enableBreakfast: true, enableLunch: true, enableDinner: true });
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
      billingStartDay: String(c.billingStartDay ?? 1),
      enableBreakfast: c.enableBreakfast !== false,
      enableLunch:     c.enableLunch     !== false,
      enableDinner:    c.enableDinner    !== false,
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
      billingStartDay: parseInt(form.billingStartDay) || 1,
      enableBreakfast: form.enableBreakfast,
      enableLunch:     form.enableLunch,
      enableDinner:    form.enableDinner,
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
    const allCustomerIds = customers.filter((c) => c.active).map((c) => c.id);
    for (const id of allCustomerIds) {
      const e = getEffectiveEntry(id);
      if (e?.breakfast) counts.breakfast++;
      if (e?.lunch)     counts.lunch++;
      if (e?.dinner)    counts.dinner++;
    }
    counts.total = counts.breakfast + counts.lunch + counts.dinner;
    return counts;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, pendingEntries, customers]);

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
            <>
            <div className="space-y-2 pb-24">
              {activeCustomers.map((c) => {
                const effective = getEffectiveEntry(c.id);
                const saved     = entries.find((e) => e.customerId === c.id);
                const isDirty   = !!pendingEntries[c.id];
                const hasMeal   = effective?.breakfast || effective?.lunch || effective?.dinner;
                return (
                  <div key={c.id} className={`bg-white border-2 rounded-2xl p-4 shadow-sm transition-all ${
                    isDirty ? "border-amber-400 bg-amber-50/30" : hasMeal ? "border-amber-300" : "border-slate-200"
                  }`}>
                    <div className="flex items-center gap-3 flex-wrap">
                      {/* Avatar */}
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center font-black text-lg flex-shrink-0 ${hasMeal ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-400"}`}>
                        {c.name[0].toUpperCase()}
                      </div>
                      {/* Name */}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-800 text-sm">{c.name}</p>
                        {c.phone && <p className="text-xs text-slate-400">{c.phone}</p>}
                        {isDirty && <p className="text-xs text-amber-600 font-semibold">● unsaved</p>}
                      </div>
                      {/* Meal toggles — only enabled meals */}
                      <div className="flex gap-2 flex-wrap">
                        {MEAL_TYPES.filter((meal) => {
                          const k = `enable${meal.charAt(0).toUpperCase() + meal.slice(1)}` as keyof RegularCustomer;
                          return c[k] !== false;
                        }).map((meal) => {
                          const cfg    = MEAL_LABELS[meal];
                          const active = effective?.[meal] ?? false;
                          const wasActive = saved?.[meal] ?? false;
                          const changed = isDirty && active !== wasActive;
                          return (
                            <button
                              key={meal}
                              onClick={() => toggleMeal(c, meal)}
                              title={cfg.label}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all ${
                                active
                                  ? `${cfg.bg} ${cfg.color} ${cfg.border} shadow-sm ${changed ? "ring-2 ring-amber-400 ring-offset-1" : ""}`
                                  : `bg-white border-slate-200 hover:border-slate-400 ${changed ? "text-red-400 border-red-200" : "text-slate-400"}`
                              }`}
                            >
                              {cfg.emoji} {cfg.short}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Sticky Save / Discard bar ─────────────────────────────────── */}
            {hasPending && (
              <div className="fixed bottom-0 left-0 right-0 md:left-56 z-40 px-4 pb-4 pt-2 bg-white/90 backdrop-blur border-t border-amber-200 shadow-lg">
                <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-amber-700">
                    ⚠️ {Object.keys(pendingEntries).length} unsaved change{Object.keys(pendingEntries).length > 1 ? "s" : ""}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={discardPending}
                      className="px-4 py-2 rounded-xl border border-slate-300 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors"
                    >
                      Discard
                    </button>
                    <button
                      onClick={saveAllPending}
                      disabled={isSavingAll}
                      className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white text-sm font-black transition-colors"
                    >
                      {isSavingAll ? "Saving…" : "✅ Save Changes"}
                    </button>
                  </div>
                </div>
              </div>
            )}
            </>
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
              {summaryByCustomer.map(({ customer: c, counts, total, daysPresent, period, dailyRate }) => {
                const payment = payments.find((p) => p.customerId === c.id && p.month === selectedMonth);
                // Balance: positive = customer still owes, negative = credit (overpaid)
                const balance = payment ? total - payment.amount : total;
                const isPrepaid = payment && payment.amount >= total - 0.5;
                const isPartialPay = payment && !isPrepaid;
                const remainingCredit = payment ? payment.amount - total : 0;
                const cardBorder = !payment ? "border-slate-200" : isPrepaid ? "border-green-300" : "border-amber-300";
                return (
                <div key={c.id} className={`bg-white border-2 rounded-2xl p-5 shadow-sm ${cardBorder}`}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center font-black text-lg ${
                        !payment ? "bg-amber-100 text-amber-700" : isPrepaid ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                      }`}>
                        {c.name[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">{c.name}</p>
                        {c.phone && <p className="text-xs text-slate-400">{c.phone}</p>}
                        <p className="text-xs text-slate-500 mt-0.5 font-medium">{period.label}</p>
                        <p className="text-xs text-slate-400">{daysPresent} / {period.days.length} days present · ₹{dailyRate}/day</p>
                        {payment && (
                          <p className={`text-xs font-semibold mt-0.5 ${isPrepaid ? "text-green-600" : "text-amber-600"}`}>
                            {isPrepaid ? `✅ Paid ₹${payment.amount.toFixed(0)}` : `⚠️ Partial ₹${payment.amount.toFixed(0)} paid`}
                            {" on "}{fmtDate(payment.paidOn)}
                            {isPartialPay && <span className="text-red-500"> · ₹{balance.toFixed(0)} pending</span>}
                            {payment.notes && <span className="text-slate-400 font-normal"> · {payment.notes}</span>}
                          </p>
                        )}
                        {!payment && total > 0 && (
                          <p className="text-xs font-semibold mt-0.5 text-red-500">❌ Not paid · ₹{total.toFixed(0)} due</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <span className="text-xl font-black text-slate-800">₹{total.toFixed(0)}</span>
                      <button
                        onClick={() => sendWhatsAppSummary({ customer: c, counts, total, daysPresent, period, dailyRate })}
                        title="Send bill via WhatsApp"
                        className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white font-bold px-3 py-1.5 rounded-xl text-xs transition-colors"
                      >
                        📲 Bill
                      </button>
                      {!payment ? (
                        <button
                          onClick={() => openPayModal(c.id, c.name, total)}
                          className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-white font-bold px-3 py-1.5 rounded-xl text-xs transition-colors"
                        >
                          💰 Mark Paid
                        </button>
                      ) : (
                        <button
                          onClick={() => unmarkPayment(c.id)}
                          className="text-xs text-red-400 hover:text-red-600 font-medium px-2 py-1.5"
                          title="Remove payment record"
                        >
                          ✕ Unmark
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Remaining balance bar */}
                  {payment && (
                    <div className={`mt-3 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 ${
                      remainingCredit >= 0 ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"
                    }`}>
                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                          {remainingCredit >= 0 ? "💰 Remaining Credit" : "⚠️ Amount Due"}
                        </p>
                        <p className={`text-lg font-black ${remainingCredit >= 0 ? "text-green-700" : "text-red-600"}`}>
                          ₹{Math.abs(remainingCredit).toFixed(0)}
                        </p>
                      </div>
                      <div className="text-right text-xs text-slate-500 space-y-0.5">
                        <p>Paid: <span className="font-bold text-slate-700">₹{payment.amount.toFixed(0)}</span></p>
                        <p>Consumed: <span className="font-bold text-slate-700">₹{total.toFixed(0)}</span></p>
                        {dailyRate > 0 && remainingCredit > 0 && (
                          <p className="text-green-600 font-medium">~{Math.floor(remainingCredit / dailyRate)} days left</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Meal breakdown */}
                  <div className="mt-4 flex flex-wrap gap-3">
                    {MEAL_TYPES.map((m) => {
                      const cfg = MEAL_LABELS[m];
                      if (c[`enable${m.charAt(0).toUpperCase() + m.slice(1)}` as keyof RegularCustomer] === false) return null;
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
                    {period.days.map((day) => {
                      const e = summaryEntries.find((x) => x.customerId === c.id && x.date === day);
                      const hasAny = e?.breakfast || e?.lunch || e?.dinner;
                      const dayNum = parseInt(day.slice(-2));
                      const isNextMonth = day.slice(0, 7) !== selectedMonth;
                      return (
                        <div key={day} title={`${fmtDate(day)}${e ? `: ${[e.breakfast && "B", e.lunch && "L", e.dinner && "D"].filter(Boolean).join("+")}` : ""}`}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold border ${
                            hasAny
                              ? "bg-amber-100 border-amber-400 text-amber-700"
                              : isNextMonth
                                ? "bg-slate-100 border-slate-300 text-slate-400"
                                : "bg-slate-50 border-slate-200 text-slate-300"
                          }`}
                        >
                          {dayNum}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
              })}

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
                      {/* Enabled meals badge */}
                      <p className="text-xs text-slate-500 mt-0.5 font-medium">
                        {[
                          c.enableBreakfast !== false && "🌅 B",
                          c.enableLunch     !== false && "☀️ L",
                          c.enableDinner    !== false && "🌙 D",
                        ].filter(Boolean).join(" · ")}
                      </p>
                      {(c.rateBreakfast || c.rateLunch || c.rateDinner) && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          {[
                            c.enableBreakfast !== false && c.rateBreakfast && `₹${c.rateBreakfast}/B`,
                            c.enableLunch     !== false && c.rateLunch     && `₹${c.rateLunch}/L`,
                            c.enableDinner    !== false && c.rateDinner    && `₹${c.rateDinner}/D`,
                          ].filter(Boolean).join(" · ")}
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
                  {(c.billingStartDay ?? 1) > 1 && (
                    <p className="text-xs text-amber-600 font-semibold mt-1 pl-14">
                      🗓 Billing: {c.billingStartDay}th – {(c.billingStartDay ?? 1) - 1}th of next month
                    </p>
                  )}
                  {c.notes && <p className="text-xs text-slate-400 mt-1 italic pl-14">"{c.notes}"</p>}
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
              {/* Which meals this customer takes */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Meals Applicable</label>
                <div className="flex gap-3">
                  {(["enableBreakfast", "enableLunch", "enableDinner"] as const).map((key) => {
                    const meal = key.replace("enable", "").toLowerCase() as MealType;
                    const cfg  = MEAL_LABELS[meal];
                    return (
                      <button key={key} type="button"
                        onClick={() => setForm((p) => ({ ...p, [key]: !p[key] }))}
                        className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 text-xs font-bold transition-all ${
                          form[key] ? `${cfg.bg} ${cfg.border} ${cfg.color}` : "bg-slate-50 border-slate-200 text-slate-400"
                        }`}
                      >
                        <span className="text-lg">{cfg.emoji}</span>
                        {cfg.label}
                        <span className="text-[10px] font-normal">{form[key] ? "✓ enabled" : "disabled"}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Custom Meal Rates (₹) <span className="font-normal text-slate-400">— leave blank to use default</span></label>
                <div className="grid grid-cols-3 gap-3">
                  {MEAL_TYPES.map((m) => {
                    const cfg = MEAL_LABELS[m];
                    const key = `rate${m.charAt(0).toUpperCase() + m.slice(1)}` as keyof typeof form;
                    const enableKey = `enable${m.charAt(0).toUpperCase() + m.slice(1)}` as keyof typeof form;
                    if (!form[enableKey]) return null;
                    return (
                      <div key={m}>
                        <label className={`block text-xs font-semibold mb-1 ${cfg.color}`}>{cfg.emoji} {cfg.label}</label>
                        <input type="number" min="0" value={form[key] as string}
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
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Billing Cycle Start Date <span className="font-normal text-slate-400">— day of month (1 = standard month, e.g. 16 = 16th–15th)</span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number" min="1" max="28"
                    value={form.billingStartDay}
                    onChange={(e) => setForm((p) => ({ ...p, billingStartDay: e.target.value }))}
                    className={INPUT_CLS + " w-24"}
                    placeholder="1"
                  />
                  {parseInt(form.billingStartDay) > 1 && (
                    <p className="text-xs text-amber-600 font-semibold">
                      Cycle: {form.billingStartDay}th of month → {parseInt(form.billingStartDay) - 1}th of next month
                    </p>
                  )}
                </div>
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

      {/* Mark Paid modal */}
      {payModal && (() => {
        const paid      = parseFloat(payAmountInput) || 0;
        const remaining = payModal.totalBill - paid;
        const isPartial = paid > 0 && remaining > 0.5;
        const isOver    = paid > payModal.totalBill + 0.5;
        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-4">
              <h3 className="text-lg font-black text-slate-800">💰 Record Payment</h3>

              {/* Total bill summary */}
              <div className="bg-slate-50 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-semibold">Total Bill</p>
                  <p className="text-2xl font-black text-slate-800">₹{payModal.totalBill.toFixed(0)}</p>
                  <p className="text-xs text-slate-400">{payModal.name}</p>
                </div>
                {remaining > 0.5 && paid > 0 && (
                  <div className="text-right">
                    <p className="text-xs text-red-500 font-semibold">Remaining</p>
                    <p className="text-xl font-black text-red-600">₹{remaining.toFixed(0)}</p>
                  </div>
                )}
                {!isPartial && paid > 0 && !isOver && (
                  <div className="text-right">
                    <p className="text-green-600 font-black text-2xl">✅</p>
                    <p className="text-xs text-green-600 font-semibold">Fully paid</p>
                  </div>
                )}
                {isOver && (
                  <div className="text-right">
                    <p className="text-xs text-amber-500 font-semibold">Advance</p>
                    <p className="text-xl font-black text-amber-600">+₹{(paid - payModal.totalBill).toFixed(0)}</p>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Amount Paying Now (₹) *</label>
                  <input
                    type="number"
                    min="1"
                    value={payAmountInput}
                    onChange={(e) => setPayAmountInput(e.target.value)}
                    autoFocus
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 font-bold text-slate-800"
                    placeholder={`₹${payModal.totalBill.toFixed(0)}`}
                  />
                  {isPartial && (
                    <p className="text-xs text-red-500 font-semibold mt-1">
                      Partial payment — ₹{remaining.toFixed(0)} still remaining
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Payment Date</label>
                  <input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Notes (optional)</label>
                  <input
                    type="text"
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                    placeholder="e.g. paid by cash / UPI"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button onClick={() => setPayModal(null)} className="flex-1 border border-slate-300 text-slate-600 font-semibold py-2.5 rounded-xl text-sm">
                  Cancel
                </button>
                <button
                  onClick={savePayment}
                  disabled={payingSaving || !payDate || paid <= 0}
                  className={`flex-1 font-black py-2.5 rounded-xl text-sm transition-colors text-white ${
                    isPartial ? "bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300" : "bg-green-600 hover:bg-green-700 disabled:bg-green-300"
                  }`}
                >
                  {payingSaving ? "Saving…" : isPartial ? `Save ₹${paid.toFixed(0)} (Partial)` : "✅ Confirm Full Payment"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

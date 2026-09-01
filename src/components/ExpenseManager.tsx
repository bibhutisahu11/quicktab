"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import SuggestionDropdown, { Suggestion, handleSuggestionKey } from "./SuggestionDropdown";
import ScanBillModal from "./ScanBillModal";

interface Expense {
  id: string;
  amount: number;
  category: string;
  description: string | null;
  date: string;
  paymentMode: string;
  addedBy: string | null;
}

interface Summary {
  expenses: Expense[];
  totalAmount: number;
  todayTotal: number;
  monthTotal: number;
  yearTotal: number;
  byCategory: Record<string, number>;
}

const CATEGORIES = [
  "Food & Beverages",
  "Staff Salary",
  "Utilities",
  "Rent",
  "Maintenance",
  "Marketing",
  "Supplies & Equipment",
  "Transportation",
  "Miscellaneous",
];

const PAYMENT_MODES = ["Cash", "UPI", "Card", "Bank Transfer", "Cheque"];

const CAT_COLORS: Record<string, string> = {
  "Food & Beverages":    "bg-orange-100 text-orange-700",
  "Staff Salary":        "bg-blue-100 text-blue-700",
  "Utilities":           "bg-yellow-100 text-yellow-700",
  "Rent":                "bg-purple-100 text-purple-700",
  "Maintenance":         "bg-red-100 text-red-700",
  "Marketing":           "bg-pink-100 text-pink-700",
  "Supplies & Equipment":"bg-teal-100 text-teal-700",
  "Transportation":      "bg-cyan-100 text-cyan-700",
  "Miscellaneous":       "bg-slate-100 text-slate-600",
};

const PAYMENT_ICONS: Record<string, string> = {
  Cash: "💵", UPI: "📱", Card: "💳", "Bank Transfer": "🏦", Cheque: "📄",
};

const EMPTY_FORM = {
  amount: "",
  category: CATEGORIES[0],
  description: "",
  date: new Date().toISOString().slice(0, 10),
  paymentMode: "Cash",
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function getMonthlyTotals(expenses: Expense[]) {
  const map: Record<string, number> = {};
  for (const e of expenses) {
    const key = new Date(e.date).toLocaleString("en-IN", { month: "short", year: "2-digit" });
    map[key] = (map[key] ?? 0) + e.amount;
  }
  // Return last 6 months sorted
  return Object.entries(map).slice(-6);
}

export default function ExpenseManager() {
  const [data, setData]         = useState<Summary | null>(null);
  const [loading, setLoading]   = useState(true);
  const [showAdd, setShowAdd]   = useState(false);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");
  const [editId, setEditId]     = useState<string | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [showScan, setShowScan] = useState(false);
  const [scanFlash, setScanFlash] = useState(false);

  // Filters
  const [filterCat,  setFilterCat]  = useState("All");
  const [filterMode, setFilterMode] = useState("All");
  const [dateFrom,   setDateFrom]   = useState("");
  const [dateTo,     setDateTo]     = useState("");
  const [search,     setSearch]     = useState("");
  const [expSugIdx, setExpSugIdx] = useState(-1);
  const expSearchRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    const params = new URLSearchParams();
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo)   params.set("to",   dateTo);
    if (filterCat !== "All") params.set("category", filterCat);
    const res = await fetch(`/api/admin/expenses?${params}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [dateFrom, dateTo, filterCat]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function handleScanned(data: { amount: number; category: string; description: string; date: string; paymentMode: string }) {
    setForm({
      amount:      String(data.amount),
      category:    data.category,
      description: data.description,
      date:        data.date,
      paymentMode: data.paymentMode,
    });
    setShowScan(false);
    setShowAdd(true);
    setScanFlash(true);
    setTimeout(() => setScanFlash(false), 2000);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, amount: Number(form.amount) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setShowAdd(false);
      setForm(EMPTY_FORM);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/expenses/${editId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editForm, amount: Number(editForm.amount) }),
      });
      if (!res.ok) throw new Error("Failed");
      setEditId(null);
      fetchData();
    } catch {
      alert("Failed to update");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this expense?")) return;
    await fetch(`/api/admin/expenses/${id}`, { method: "DELETE" });
    fetchData();
  }

  function exportCsv() {
    if (!data) return;
    const rows = [
      ["Date", "Category", "Description", "Amount (₹)", "Payment Mode", "Added By"],
      ...data.expenses.map((e) => [
        fmtDate(e.date), e.category, e.description ?? "", e.amount.toFixed(2), e.paymentMode, e.addedBy ?? "",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `expenses-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  // Filtered expenses (client-side search + payment mode filter)
  const displayed = (data?.expenses ?? []).filter((e) => {
    if (filterMode !== "All" && e.paymentMode !== filterMode) return false;
    if (search) {
      const q = search.toLowerCase();
      return e.category.toLowerCase().includes(q) || (e.description ?? "").toLowerCase().includes(q);
    }
    return true;
  });

  const expenseSuggestions: Suggestion[] = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || !data?.expenses) return [];
    const all = data.expenses.filter((e) =>
      e.category.toLowerCase().includes(q) || (e.description ?? "").toLowerCase().includes(q)
    );
    const unique = [...new Set(all.map((e) => e.description ?? e.category))].slice(0, 6);
    return unique.map((d) => ({ id: d, primary: d }));
  }, [data, search]);

  const monthlyTotals = data ? getMonthlyTotals(data.expenses) : [];
  const maxMonthly = Math.max(...monthlyTotals.map(([, v]) => v), 1);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center">
          <div className="text-5xl animate-pulse mb-4">💰</div>
          <p className="text-slate-500">Loading expenses…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Expenses</h1>
          <p className="text-slate-500 text-sm">{data?.expenses.length ?? 0} records</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={exportCsv} className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-4 py-2 rounded-xl text-sm transition-colors">
            ⬇ Export CSV
          </button>
          <button onClick={() => setShowScan(true)} className="bg-white border border-amber-300 hover:bg-amber-50 text-amber-700 font-semibold px-4 py-2 rounded-xl text-sm transition-colors flex items-center gap-1.5">
            🧾 Scan Bill
          </button>
          <button onClick={() => { setShowAdd(true); setError(""); setForm(EMPTY_FORM); }} className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-5 py-2 rounded-xl text-sm transition-colors">
            + Add Expense
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Today",      value: data?.todayTotal  ?? 0, icon: "📅", color: "from-blue-50 to-blue-100 border-blue-200" },
          { label: "This Month", value: data?.monthTotal  ?? 0, icon: "📆", color: "from-amber-50 to-orange-100 border-amber-200" },
          { label: "This Year",  value: data?.yearTotal   ?? 0, icon: "📊", color: "from-purple-50 to-purple-100 border-purple-200" },
          { label: "All Time",   value: data?.totalAmount ?? 0, icon: "💼", color: "from-slate-50 to-slate-100 border-slate-200" },
        ].map((card) => (
          <div key={card.label} className={`bg-gradient-to-br ${card.color} border rounded-2xl px-5 py-4`}>
            <div className="text-2xl mb-1">{card.icon}</div>
            <p className="text-xs text-slate-500 font-medium">{card.label}</p>
            <p className="text-xl font-bold text-slate-800 mt-0.5">{fmt(card.value)}</p>
          </div>
        ))}
      </div>

      {/* Monthly bar chart */}
      {monthlyTotals.length > 1 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h3 className="font-bold text-slate-700 mb-4">Monthly Trend</h3>
          <div className="flex items-end gap-3 h-28">
            {monthlyTotals.map(([month, total]) => (
              <div key={month} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs text-slate-500 truncate w-full text-center">{fmt(total)}</span>
                <div
                  className="w-full bg-amber-400 rounded-t-lg transition-all"
                  style={{ height: `${Math.max(8, (total / maxMonthly) * 72)}px` }}
                />
                <span className="text-xs text-slate-400">{month}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category breakdown */}
      {data && Object.keys(data.byCategory).length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h3 className="font-bold text-slate-700 mb-4">By Category</h3>
          <div className="space-y-3">
            {Object.entries(data.byCategory)
              .sort(([, a], [, b]) => b - a)
              .map(([cat, amt]) => {
                const pct = data.totalAmount > 0 ? (amt / data.totalAmount) * 100 : 0;
                return (
                  <div key={cat} className="flex items-center gap-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full w-40 text-center truncate ${CAT_COLORS[cat] ?? "bg-slate-100 text-slate-600"}`}>
                      {cat}
                    </span>
                    <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div className="bg-amber-400 h-full rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-sm font-semibold text-slate-700 w-24 text-right">{fmt(amt)}</span>
                    <span className="text-xs text-slate-400 w-10 text-right">{pct.toFixed(0)}%</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Scan Bill Modal */}
      {showScan && <ScanBillModal onScanned={handleScanned} onClose={() => setShowScan(false)} />}

      {/* Scan success flash */}
      {scanFlash && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl px-5 py-3 flex items-center gap-3 animate-pulse">
          <span className="text-xl">✅</span>
          <p className="font-semibold text-sm">Bill scanned! Review the details below and save.</p>
        </div>
      )}

      {/* Add Expense Form */}
      {showAdd && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="font-bold text-slate-800">New Expense</h2>
            {scanFlash && (
              <span className="bg-green-100 text-green-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-green-200">
                ✨ Pre-filled from scan
              </span>
            )}
          </div>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2 mb-4">{error}</div>}
          <form onSubmit={handleAdd} className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Amount (₹) *</label>
              <input type="number" min="0.01" step="0.01" required value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="0.00" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Category *</label>
              <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white">
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Date</label>
              <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Payment Mode</label>
              <select value={form.paymentMode} onChange={(e) => setForm((f) => ({ ...f, paymentMode: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white">
                {PAYMENT_MODES.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Description (optional)</label>
              <input type="text" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="e.g. Vegetables for weekend, Electricity bill July…"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div className="sm:col-span-2 flex gap-3">
              <button type="submit" disabled={saving}
                className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-bold py-2.5 rounded-xl text-sm transition-colors">
                {saving ? "Saving…" : "Add Expense"}
              </button>
              <button type="button" onClick={() => { setShowAdd(false); setError(""); }}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2.5 rounded-xl text-sm">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Expense Modal */}
      {editId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditId(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="font-bold text-slate-800 text-lg mb-5">Edit Expense</h2>
            <form onSubmit={handleEdit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Amount (₹)</label>
                  <input type="number" min="0.01" step="0.01" required value={editForm.amount}
                    onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Date</label>
                  <input type="date" value={editForm.date} onChange={(e) => setEditForm((f) => ({ ...f, date: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Category</label>
                <select value={editForm.category} onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white">
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Payment Mode</label>
                <select value={editForm.paymentMode} onChange={(e) => setEditForm((f) => ({ ...f, paymentMode: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white">
                  {PAYMENT_MODES.map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Description</label>
                <input type="text" value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-400 text-white font-bold py-3 rounded-xl transition-colors">
                  {saving ? "Saving…" : "Update"}
                </button>
                <button type="button" onClick={() => setEditId(null)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-3 rounded-xl">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex gap-3 flex-wrap items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">From</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">To</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Category</label>
            <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white">
              <option value="All">All Categories</option>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Payment</label>
            <select value={filterMode} onChange={(e) => setFilterMode(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white">
              <option value="All">All Modes</option>
              {PAYMENT_MODES.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-40">
            <label className="block text-xs font-semibold text-slate-500 mb-1">Search</label>
            <div className="relative">
              <input
                ref={expSearchRef}
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setExpSugIdx(-1); }}
                onKeyDown={(e) => handleSuggestionKey(e, expenseSuggestions.length, expSugIdx, setExpSugIdx,
                  (idx) => { setSearch(expenseSuggestions[idx].primary); setExpSugIdx(-1); expSearchRef.current?.focus(); },
                  () => { setSearch(""); setExpSugIdx(-1); }
                )}
                placeholder="Search…"
                autoComplete="off"
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <SuggestionDropdown suggestions={expenseSuggestions} activeIdx={expSugIdx}
                onSelect={(s) => { setSearch(s.primary); setExpSugIdx(-1); }} />
            </div>
          </div>
          {(dateFrom || dateTo || filterCat !== "All" || filterMode !== "All" || search) && (
            <button onClick={() => { setDateFrom(""); setDateTo(""); setFilterCat("All"); setFilterMode("All"); setSearch(""); }}
              className="text-sm text-amber-600 hover:text-amber-800 font-medium underline self-end pb-1.5">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Expense list */}
      {displayed.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <div className="text-5xl mb-3">💸</div>
          <p className="text-lg">No expenses found</p>
          <button onClick={() => { setShowAdd(true); }}
            className="mt-4 bg-amber-500 hover:bg-amber-600 text-white font-semibold px-6 py-2.5 rounded-xl text-sm">
            Add first expense
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Category</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Description</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Mode</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Amount</th>
                <th className="px-3 py-3 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {displayed.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-5 py-3 text-slate-600 whitespace-nowrap">{fmtDate(e.date)}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${CAT_COLORS[e.category] ?? "bg-slate-100 text-slate-600"}`}>
                      {e.category}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-600 max-w-xs truncate">{e.description ?? <span className="text-slate-300">—</span>}</td>
                  <td className="px-5 py-3 text-slate-600">
                    <span className="flex items-center gap-1">
                      <span>{PAYMENT_ICONS[e.paymentMode] ?? "💰"}</span>
                      <span className="text-xs">{e.paymentMode}</span>
                    </span>
                  </td>
                  <td className="px-5 py-3 font-bold text-slate-800 text-right whitespace-nowrap">{fmt(e.amount)}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => {
                        setEditId(e.id);
                        setEditForm({
                          amount: String(e.amount),
                          category: e.category,
                          description: e.description ?? "",
                          date: new Date(e.date).toISOString().slice(0, 10),
                          paymentMode: e.paymentMode,
                        });
                      }} className="text-slate-400 hover:text-amber-600 transition-colors px-1 text-base" title="Edit">✏️</button>
                      <button onClick={() => handleDelete(e.id)}
                        className="text-slate-300 hover:text-red-500 transition-colors text-lg px-1" title="Delete">×</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 border-t border-slate-200">
                <td colSpan={4} className="px-5 py-3 text-sm font-semibold text-slate-700">
                  {displayed.length} expense{displayed.length !== 1 ? "s" : ""}
                </td>
                <td className="px-5 py-3 font-bold text-slate-900 text-right text-base">
                  {fmt(displayed.reduce((s, e) => s + e.amount, 0))}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

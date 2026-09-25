"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useSession } from "next-auth/react";
import { EXPENSE_CATALOG, ALL_CATALOG_ITEMS, ALL_UNITS, type CatalogCategory } from "@/lib/expenseCatalog";
import ScanBillModal from "./ScanBillModal";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Expense {
  id: string;
  amount: number;
  category: string;
  subCategory: string | null;
  description: string | null;
  quantity: number | null;
  unit: string | null;
  date: string;
  paymentMode: string;
  addedBy: string | null;
}

interface ProductStat {
  name: string;
  count: number;
  total: number;
  category: string;
}

interface ReorderSuggestion {
  name: string;
  category: string;
  lastMonthCount: number;
  lastMonthTotal: number;
  avgAmount: number;
}

interface Summary {
  expenses: Expense[];
  totalAmount: number;
  todayTotal: number;
  monthTotal: number;
  yearTotal: number;
  byCategory: Record<string, number>;
  productStats: ProductStat[];
  reorderSuggestions: ReorderSuggestion[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAYMENT_MODES = ["Cash", "UPI", "Card", "Bank Transfer", "Cheque"];
const PAYMENT_ICONS: Record<string, string> = {
  Cash: "💵", UPI: "📱", Card: "💳", "Bank Transfer": "🏦", Cheque: "📄",
};

// Batch item accumulated before saving
interface BatchItem {
  id: string;
  catId: string;
  catLabel: string;
  catEmoji: string;
  itemName: string;
  qty: string;
  unit: string;
  amount: string;
  paymentMode: string;
}

function emptyForm() {
  return {
    catalogCatId: "",        // parent category id
    catalogItem:  "",        // child item name
    itemSearch:   "",        // search text in child dropdown
  };
}

function today() { return new Date().toISOString().slice(0, 10); }

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  return Object.entries(map).slice(-6);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ExpenseManager() {
  const { data: session } = useSession();
  const role = session?.user?.role ?? "";
  const canDelete = ["HOTEL_ADMIN", "MANAGER", "SUPER_ADMIN"].includes(role);

  const [data, setData]       = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"list" | "analytics">("list");

  // Add form
  const [showAdd, setShowAdd]   = useState(false);
  const [form, setForm]         = useState(emptyForm());
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const itemInputRef = useRef<HTMLInputElement>(null);

  // Batch items (multi-item add)
  const [batchItems, setBatchItems]   = useState<BatchItem[]>([]);
  const [batchDate, setBatchDate]     = useState(today());
  const [showCatalog, setShowCatalog] = useState(true);

  // Edit modal
  const [editId, setEditId]     = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ ...emptyForm(), quantity: "", unit: "", amount: "", description: "", date: today(), paymentMode: "Cash" });

  // Scan
  const [showScan, setShowScan] = useState(false);
  const [scanFlash, setScanFlash] = useState(false);

  // Filters
  const [filterCat,  setFilterCat]  = useState("All");
  const [filterMode, setFilterMode] = useState("All");
  const [dateFrom,   setDateFrom]   = useState("");
  const [dateTo,     setDateTo]     = useState("");
  const [search,     setSearch]     = useState("");

  // ── Fetch ────────────────────────────────────────────────────────────────────

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

  // ── Active catalog items for selected parent category ────────────────────────

  const activeCat: CatalogCategory | null = useMemo(
    () => EXPENSE_CATALOG.find((c) => c.id === form.catalogCatId) ?? null,
    [form.catalogCatId]
  );

  const filteredItems = useMemo(() => {
    const src = activeCat ? activeCat.items : ALL_CATALOG_ITEMS;
    const q = form.itemSearch.trim().toLowerCase();
    if (!q) return src.slice(0, 50);
    return src.filter((i) => i.name.toLowerCase().includes(q)).slice(0, 50);
  }, [activeCat, form.itemSearch]);

  // When user selects an item → push into batch list, clear search for next item
  function selectItem(name: string) {
    const found  = ALL_CATALOG_ITEMS.find((i) => i.name === name);
    const cat    = EXPENSE_CATALOG.find((c) => c.id === form.catalogCatId);
    // Don't duplicate the same item in batch
    if (batchItems.find((b) => b.itemName === name && b.catId === form.catalogCatId)) {
      setForm((f) => ({ ...f, catalogItem: "", itemSearch: "" }));
      setShowItemDropdown(false);
      setTimeout(() => itemInputRef.current?.focus(), 50);
      return;
    }
    setBatchItems((p) => [...p, {
      id: Math.random().toString(36).slice(2),
      catId:       form.catalogCatId,
      catLabel:    cat?.label  ?? "",
      catEmoji:    cat?.emoji  ?? "💰",
      itemName:    name,
      qty:         "",
      unit:        found?.unit ?? "",
      amount:      "",
      paymentMode: "Cash",
    }]);
    setForm((f) => ({ ...f, catalogItem: "", itemSearch: "" }));
    setShowItemDropdown(false);
    setShowCatalog(false); // auto-collapse catalog after each pick
  }

  // When parent category changes, reset child search
  function selectCategory(id: string) {
    setForm((f) => ({ ...f, catalogCatId: id, catalogItem: "", itemSearch: "" }));
    setShowItemDropdown(true);
    setTimeout(() => itemInputRef.current?.focus(), 50);
  }

  function updateBatchItem(id: string, patch: Partial<BatchItem>) {
    setBatchItems((p) => p.map((b) => b.id === id ? { ...b, ...patch } : b));
  }
  function removeBatchItem(id: string) {
    setBatchItems((p) => p.filter((b) => b.id !== id));
  }

  // ── Save ─────────────────────────────────────────────────────────────────────

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (batchItems.length === 0) { setError("Add at least one item from the catalog above"); return; }
    const invalid = batchItems.find((b) => !b.amount || Number(b.amount) <= 0);
    if (invalid) { setError(`Enter amount for "${invalid.itemName}"`); return; }
    setSaving(true);
    try {
      await Promise.all(batchItems.map((b) =>
        fetch("/api/admin/expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category:    b.catLabel,
            subCategory: b.itemName,
            quantity:    b.qty ? Number(b.qty) : null,
            unit:        b.unit || null,
            amount:      Number(b.amount),
            date:        batchDate,
            paymentMode: b.paymentMode,
          }),
        })
      ));
      setShowAdd(false);
      setForm(emptyForm());
      setBatchItems([]);
      setBatchDate(today());
      setShowCatalog(true);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this expense?")) return;
    await fetch(`/api/admin/expenses/${id}`, { method: "DELETE" });
    fetchData();
  }

  function handleScanned(d: { amount: number; category: string; description: string; date: string; paymentMode: string }) {
    setForm((f) => ({
      ...f,
      amount:      String(d.amount),
      catalogItem: d.description,
      itemSearch:  d.description,
      description: d.description,
      date:        d.date,
      paymentMode: d.paymentMode,
    }));
    setShowScan(false);
    setShowAdd(true);
    setScanFlash(true);
    setTimeout(() => setScanFlash(false), 2000);
  }

  function exportCsv() {
    if (!data) return;
    const rows = [
      ["Date", "Category", "Item", "Qty", "Unit", "Amount (₹)", "Payment Mode", "Notes", "Added By"],
      ...data.expenses.map((e) => [
        fmtDate(e.date), e.category, e.subCategory ?? "", e.quantity ?? "", e.unit ?? "",
        e.amount.toFixed(2), e.paymentMode, e.description ?? "", e.addedBy ?? "",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `expenses-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  // ── Filters ───────────────────────────────────────────────────────────────────

  const allCatLabels = EXPENSE_CATALOG.map((c) => c.label);

  const displayed = (data?.expenses ?? []).filter((e) => {
    if (filterMode !== "All" && e.paymentMode !== filterMode) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        e.category.toLowerCase().includes(q) ||
        (e.subCategory ?? "").toLowerCase().includes(q) ||
        (e.description ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const monthlyTotals = data ? getMonthlyTotals(data.expenses) : [];
  const maxMonthly    = Math.max(...monthlyTotals.map(([, v]) => v), 1);

  // ── Analytics data ────────────────────────────────────────────────────────────
  const top10Spend  = (data?.productStats ?? []).slice(0, 10);
  const top10Count  = [...(data?.productStats ?? [])].sort((a, b) => b.count - a.count).slice(0, 10);
  const least10     = [...(data?.productStats ?? [])].sort((a, b) => a.count - b.count).slice(0, 10);
  const maxSpend    = top10Spend[0]?.total ?? 1;
  const maxCount    = top10Count[0]?.count ?? 1;

  // ── Category color lookup ─────────────────────────────────────────────────────
  function getCatColor(label: string) {
    return EXPENSE_CATALOG.find((c) => c.label === label)?.color ?? "bg-slate-100 text-slate-600";
  }
  function getCatEmoji(label: string) {
    return EXPENSE_CATALOG.find((c) => c.label === label)?.emoji ?? "💰";
  }

  // ─────────────────────────────────────────────────────────────────────────────

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

      {/* ── Header ─────────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Expenses</h1>
          <p className="text-slate-500 text-sm">{data?.expenses.length ?? 0} records</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={exportCsv} className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-4 py-2 rounded-xl text-sm transition-colors">
            ⬇ CSV
          </button>
          <button onClick={() => setShowScan(true)} className="bg-white border border-amber-300 hover:bg-amber-50 text-amber-700 font-semibold px-4 py-2 rounded-xl text-sm flex items-center gap-1.5">
            🧾 Scan Bill
          </button>
          <button onClick={() => { setShowAdd(true); setError(""); setForm(emptyForm()); }}
            className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-5 py-2 rounded-xl text-sm transition-colors">
            + Add Expense
          </button>
        </div>
      </div>

      {/* ── Summary cards ──────────────────────────────────────────────────────── */}
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

      {/* ── Tab bar ────────────────────────────────────────────────────────────── */}
      <div className="flex gap-2 bg-slate-100 rounded-xl p-1 w-fit">
        {([["list", "📋 Expenses"], ["analytics", "📊 Analytics"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === id ? "bg-white text-slate-800 shadow" : "text-slate-500 hover:text-slate-700"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ══════════════════════ ANALYTICS TAB ══════════════════════════════════ */}
      {activeTab === "analytics" && (
        <div className="space-y-6">

          {/* ── Reorder Suggestions ─────────────────────────────────────────────── */}
          {(data?.reorderSuggestions?.length ?? 0) > 0 && (() => {
            const suggestions = data!.reorderSuggestions;
            const currentMonth = new Date().toLocaleDateString("en-IN", { month: "long" });
            return (
              <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 shadow-sm">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div>
                    <h3 className="font-black text-amber-800 text-base">🛒 What to Reorder This Month</h3>
                    <p className="text-xs text-amber-600 mt-0.5">
                      Based on last month&apos;s purchases — not yet ordered in {currentMonth}. Resets automatically on 1st.
                    </p>
                  </div>
                  <span className="bg-amber-400 text-white text-xs font-bold px-2.5 py-1 rounded-full shrink-0">
                    {suggestions.length} items
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {suggestions.map((s) => (
                    <div key={s.name} className="bg-white border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 text-sm truncate">{s.name}</p>
                        <p className="text-xs text-slate-400">
                          {getCatEmoji(s.category)} {s.category} · bought {s.lastMonthCount}× last month
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-amber-700">{fmt(s.avgAmount)}</p>
                        <p className="text-xs text-slate-400">avg/purchase</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Monthly bar chart */}
          {monthlyTotals.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h3 className="font-bold text-slate-700 mb-4">Monthly Spend Trend</h3>
              <div className="flex items-end gap-3 h-32">
                {monthlyTotals.map(([month, total]) => (
                  <div key={month} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] text-slate-500 truncate w-full text-center">{fmt(total)}</span>
                    <div className="w-full bg-amber-400 rounded-t-lg" style={{ height: `${Math.max(8, (total / maxMonthly) * 80)}px` }} />
                    <span className="text-[10px] text-slate-400">{month}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Category breakdown */}
          {data && Object.keys(data.byCategory).length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h3 className="font-bold text-slate-700 mb-4">Spend by Category</h3>
              <div className="space-y-3">
                {Object.entries(data.byCategory).sort(([, a], [, b]) => b - a).map(([cat, amt]) => {
                  const pct = data.totalAmount > 0 ? (amt / data.totalAmount) * 100 : 0;
                  return (
                    <div key={cat} className="flex items-center gap-3">
                      <span className="text-base">{getCatEmoji(cat)}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full w-36 text-center truncate ${getCatColor(cat)}`}>{cat}</span>
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

          {/* Top 10 by Spend */}
          {top10Spend.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h3 className="font-bold text-slate-700 mb-1">🔥 Top Items by Total Spend</h3>
              <p className="text-xs text-slate-400 mb-4">Most money spent on these items</p>
              <div className="space-y-2.5">
                {top10Spend.map((p, i) => (
                  <div key={p.name} className="flex items-center gap-3">
                    <span className="text-sm font-black text-slate-400 w-5">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{p.name}</p>
                      <p className="text-xs text-slate-400">{getCatEmoji(p.category)} {p.category} · {p.count}×</p>
                    </div>
                    <div className="w-32 bg-slate-100 rounded-full h-2">
                      <div className="bg-rose-400 h-full rounded-full" style={{ width: `${(p.total / maxSpend) * 100}%` }} />
                    </div>
                    <span className="text-sm font-bold text-rose-600 w-20 text-right">{fmt(p.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top 10 by Frequency */}
          {top10Count.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h3 className="font-bold text-slate-700 mb-1">📦 Most Frequently Purchased</h3>
              <p className="text-xs text-slate-400 mb-4">Bought the most number of times</p>
              <div className="space-y-2.5">
                {top10Count.map((p, i) => (
                  <div key={p.name} className="flex items-center gap-3">
                    <span className="text-sm font-black text-slate-400 w-5">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{p.name}</p>
                      <p className="text-xs text-slate-400">{getCatEmoji(p.category)} {p.category}</p>
                    </div>
                    <div className="w-32 bg-slate-100 rounded-full h-2">
                      <div className="bg-indigo-400 h-full rounded-full" style={{ width: `${(p.count / maxCount) * 100}%` }} />
                    </div>
                    <span className="text-sm font-bold text-indigo-600 w-16 text-right">{p.count}× </span>
                    <span className="text-xs text-slate-500 w-20 text-right">{fmt(p.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Least used */}
          {least10.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h3 className="font-bold text-slate-700 mb-1">🧊 Least Purchased Items</h3>
              <p className="text-xs text-slate-400 mb-4">Items bought least often (possibly one-offs)</p>
              <div className="flex flex-wrap gap-2">
                {least10.map((p) => (
                  <div key={p.name} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-600">
                    {p.name} <span className="font-bold text-slate-400">·</span> {p.count}× <span className="font-bold text-slate-400">·</span> {fmt(p.total)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════ LIST TAB ════════════════════════════════════════ */}
      {activeTab === "list" && (
        <div className="space-y-5">

          {/* Scan Bill Modal */}
          {showScan && <ScanBillModal onScanned={handleScanned} onClose={() => setShowScan(false)} />}

          {scanFlash && (
            <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl px-5 py-3 flex items-center gap-3 animate-pulse">
              <span className="text-xl">✅</span>
              <p className="font-semibold text-sm">Bill scanned! Review details below and save.</p>
            </div>
          )}

          {/* ── Add Expense Panel ───────────────────────────────────────────────── */}
          {showAdd && (
            <div className="bg-white rounded-2xl border-2 border-amber-200 shadow-sm p-6">
              {/* Header with minimize toggle */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-slate-800 text-base">➕ Add Expense</h2>
                <button type="button" onClick={() => { setShowAdd(false); setForm(emptyForm()); setBatchItems([]); setShowCatalog(true); }}
                  className="text-slate-400 hover:text-slate-600 text-sm font-medium px-2 py-1 rounded-lg hover:bg-slate-100">✕ Close</button>
              </div>
              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2 mb-4">{error}</div>}

              <form onSubmit={handleAdd} className="space-y-4">

                {/* ── Catalog section (collapsible) ─────────────────────────── */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  {/* Catalog header — click to toggle */}
                  <button type="button"
                    onClick={() => setShowCatalog((v) => !v)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left">
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                      {showCatalog ? "▲ Hide Catalog" : "▼ Pick Items from Catalog"}
                    </span>
                    {!showCatalog && batchItems.length > 0 && (
                      <span className="text-xs bg-amber-500 text-white font-bold px-2 py-0.5 rounded-full">{batchItems.length} added</span>
                    )}
                  </button>

                  {showCatalog && (
                    <div className="p-4 space-y-3">
                      {/* Category tiles */}
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Category *</label>
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                          {EXPENSE_CATALOG.map((cat) => (
                            <button key={cat.id} type="button"
                              onClick={() => selectCategory(cat.id)}
                              className={`flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl border-2 text-xs font-semibold transition-all ${
                                form.catalogCatId === cat.id
                                  ? `${cat.color} ${cat.borderColor} shadow-sm`
                                  : "bg-white border-slate-200 text-slate-500 hover:border-slate-400"
                              }`}
                            >
                              <span className="text-lg">{cat.emoji}</span>
                              <span className="text-center leading-tight">{cat.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Item search */}
                      {form.catalogCatId && (
                        <div className="relative">
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                            Item / Product — tap to add to list
                          </label>
                          <input
                            ref={itemInputRef}
                            type="text"
                            value={form.itemSearch}
                            onChange={(e) => { setForm((f) => ({ ...f, itemSearch: e.target.value, catalogItem: "" })); setShowItemDropdown(true); }}
                            onFocus={() => setShowItemDropdown(true)}
                            placeholder={`Search ${activeCat?.label ?? ""} items…`}
                            className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 font-medium"
                            autoComplete="off"
                          />
                          {showItemDropdown && filteredItems.length > 0 && (
                            <div className="absolute z-30 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl mt-1 max-h-56 overflow-y-auto">
                              {filteredItems.map((item) => {
                                const hasCat = !activeCat;
                                const fullItem = hasCat ? (item as typeof ALL_CATALOG_ITEMS[0]) : null;
                                const alreadyAdded = batchItems.some((b) => b.itemName === item.name && b.catId === form.catalogCatId);
                                return (
                                  <button key={item.name} type="button" onClick={() => selectItem(item.name)}
                                    className={`w-full text-left px-4 py-2.5 flex items-center justify-between gap-2 border-b border-slate-50 last:border-none transition-colors ${alreadyAdded ? "bg-green-50" : "hover:bg-amber-50"}`}>
                                    <div>
                                      <p className="text-sm font-semibold text-slate-800">{item.name} {alreadyAdded && <span className="text-green-600 text-xs">✓ added</span>}</p>
                                      {hasCat && fullItem && <p className="text-xs text-slate-400">{fullItem.categoryEmoji} {fullItem.categoryLabel}</p>}
                                    </div>
                                    <span className="text-xs text-slate-400 shrink-0">{item.unit}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ── Batch item list ────────────────────────────────────────── */}
                {batchItems.length === 0 ? (
                  <div className="text-center py-5 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl">
                    Open catalog above → pick items → they appear here
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                        🛒 Items ({batchItems.length}) — fill amount &amp; payment for each
                      </label>
                    </div>

                    {batchItems.map((b) => (
                      <div key={b.id} className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                        {/* Row 1: name + remove */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-base leading-none">{b.catEmoji}</span>
                            <div>
                              <p className="text-sm font-bold text-slate-800 leading-tight">{b.itemName}</p>
                              <p className="text-[10px] text-slate-400">{b.catLabel}</p>
                            </div>
                          </div>
                          <button type="button" onClick={() => removeBatchItem(b.id)}
                            className="text-slate-300 hover:text-red-500 text-xl font-bold leading-none px-1" title="Remove">×</button>
                        </div>
                        {/* Row 2: qty + unit + amount + payment */}
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Qty</label>
                            <input type="number" min="0" step="any" value={b.qty}
                              onChange={(e) => updateBatchItem(b.id, { qty: e.target.value })}
                              placeholder="e.g. 2"
                              className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 text-center" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Unit</label>
                            <select value={b.unit} onChange={(e) => updateBatchItem(b.id, { unit: e.target.value })}
                              className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400">
                              <option value="">—</option>
                              {ALL_UNITS.map((u) => <option key={u}>{u}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Amount ₹ *</label>
                            <input type="number" min="0.01" step="0.01" value={b.amount}
                              onChange={(e) => updateBatchItem(b.id, { amount: e.target.value })}
                              placeholder="0.00"
                              className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 font-bold" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Payment</label>
                            <select value={b.paymentMode} onChange={(e) => updateBatchItem(b.id, { paymentMode: e.target.value })}
                              className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400">
                              {PAYMENT_MODES.map((m) => <option key={m} value={m}>{PAYMENT_ICONS[m]} {m}</option>)}
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Total preview */}
                    <div className="flex justify-between items-center bg-slate-50 rounded-xl px-4 py-2.5 border border-slate-200">
                      <span className="text-xs text-slate-500 font-semibold">{batchItems.length} item{batchItems.length !== 1 ? "s" : ""} · Total</span>
                      <span className="text-lg font-black text-amber-700">
                        {fmt(batchItems.reduce((s, b) => s + (Number(b.amount) || 0), 0))}
                      </span>
                    </div>
                  </div>
                )}

                {/* ── Shared date ───────────────────────────────────────────────── */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Date (for all items)</label>
                  <input type="date" value={batchDate} onChange={(e) => setBatchDate(e.target.value)}
                    style={{ colorScheme: "light" }}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>

                <div className="flex gap-3 pt-1">
                  <button type="submit" disabled={saving || batchItems.length === 0}
                    className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-3 rounded-xl text-sm transition-colors">
                    {saving ? "Saving…" : batchItems.length === 0 ? "Add items from catalog above" : `✅ Save ${batchItems.length} Expense${batchItems.length !== 1 ? "s" : ""}`}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ── Filters ─────────────────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className="flex gap-3 flex-wrap items-end">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">From</label>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                  style={{ colorScheme: "light" }}
                  className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">To</label>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                  style={{ colorScheme: "light" }}
                  className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Category</label>
                <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}
                  className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white">
                  <option value="All">All</option>
                  {allCatLabels.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Payment</label>
                <select value={filterMode} onChange={(e) => setFilterMode(e.target.value)}
                  className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white">
                  <option value="All">All</option>
                  {PAYMENT_MODES.map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div className="flex-1 min-w-36">
                <label className="block text-xs font-semibold text-slate-500 mb-1">Search item</label>
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Potato, Mustard Oil…"
                  className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
              {(dateFrom || dateTo || filterCat !== "All" || filterMode !== "All" || search) && (
                <button onClick={() => { setDateFrom(""); setDateTo(""); setFilterCat("All"); setFilterMode("All"); setSearch(""); }}
                  className="text-sm text-amber-600 hover:text-amber-800 font-medium underline self-end pb-1.5">
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* ── Expense list ─────────────────────────────────────────────────────── */}
          {displayed.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <div className="text-5xl mb-3">💸</div>
              <p className="text-lg">No expenses found</p>
              <button onClick={() => setShowAdd(true)}
                className="mt-4 bg-amber-500 hover:bg-amber-600 text-white font-semibold px-6 py-2.5 rounded-xl text-sm">
                Add first expense
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm text-slate-800">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Category</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Item</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Qty</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Mode</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Amount</th>
                    {canDelete && <th className="px-3 py-3 w-12" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {displayed.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{fmtDate(e.date)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getCatColor(e.category)}`}>
                          {getCatEmoji(e.category)} {e.category}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800 text-sm">{e.subCategory ?? e.description ?? "—"}</p>
                        {e.description && e.subCategory && (
                          <p className="text-xs text-slate-400 truncate max-w-[160px]">{e.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                        {e.quantity != null ? `${e.quantity} ${e.unit ?? ""}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <span className="flex items-center gap-1 text-xs">
                          {PAYMENT_ICONS[e.paymentMode] ?? "💰"} {e.paymentMode}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-800 text-right whitespace-nowrap">{fmt(e.amount)}</td>
                      {canDelete && (
                        <td className="px-3 py-3">
                          <button onClick={() => handleDelete(e.id)}
                            className="text-slate-300 hover:text-red-500 transition-colors text-xl px-1" title="Delete">×</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t border-slate-200">
                    <td colSpan={canDelete ? 5 : 4} className="px-4 py-3 text-xs font-semibold text-slate-500">
                      {displayed.length} entries
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-800 text-right">
                      {fmt(displayed.reduce((s, e) => s + e.amount, 0))}
                    </td>
                    {canDelete && <td />}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

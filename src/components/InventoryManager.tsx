"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import SuggestionDropdown, { Suggestion, handleSuggestionKey } from "./SuggestionDropdown";

interface StockLog {
  id: string;
  change: number;
  note: string | null;
  type: "IN" | "OUT" | "ADJUSTMENT";
  createdAt: string;
}

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  minStock: number;
  updatedAt: string;
  logs: StockLog[];
}

const UNITS = ["units", "kg", "g", "liters", "ml", "dozen", "packets", "boxes", "bottles", "bags"];
const EMPTY_FORM = { name: "", category: "General", quantity: "0", unit: "units", minStock: "0" };

function stockStatus(item: InventoryItem): "out" | "low" | "ok" {
  if (item.quantity <= 0) return "out";
  if (item.minStock > 0 && item.quantity <= item.minStock) return "low";
  return "ok";
}

const STATUS_STYLES = {
  out: { badge: "bg-red-100 text-red-700 border border-red-200",   bar: "bg-red-400",   label: "Out of Stock" },
  low: { badge: "bg-amber-100 text-amber-700 border border-amber-200", bar: "bg-amber-400", label: "Low Stock" },
  ok:  { badge: "bg-green-100 text-green-700 border border-green-200", bar: "bg-green-400", label: "In Stock" },
};

export default function InventoryManager() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adjustId, setAdjustId] = useState<string | null>(null);
  const [adjustForm, setAdjustForm] = useState({ type: "IN" as "IN" | "OUT" | "ADJUSTMENT", change: "", note: "" });
  const [adjusting, setAdjusting] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"all" | "low" | "out">("all");
  const [search, setSearch] = useState("");
  const [invSugIdx, setInvSugIdx] = useState(-1);
  const invSearchRef = useRef<HTMLInputElement>(null);

  async function fetchItems() {
    const res = await fetch("/api/admin/inventory");
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }

  useEffect(() => { fetchItems(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, quantity: Number(form.quantity), minStock: Number(form.minStock) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setItems((prev) => [...prev, data]);
      setShowAdd(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add item");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this inventory item?")) return;
    await fetch(`/api/admin/inventory/${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  async function handleAdjust(e: React.FormEvent) {
    e.preventDefault();
    if (!adjustId || !adjustForm.change) return;
    setAdjusting(true);
    try {
      const res = await fetch(`/api/admin/inventory/${adjustId}/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(adjustForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setItems((prev) => prev.map((i) => (i.id === adjustId ? data.item : i)));
      setAdjustId(null);
      setAdjustForm({ type: "IN", change: "", note: "" });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed");
    } finally {
      setAdjusting(false);
    }
  }

  const invSuggestions: Suggestion[] = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return items.filter((i) => i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q))
      .slice(0, 6).map((i) => ({ id: i.id, primary: i.name, secondary: i.category }));
  }, [items, search]);

  const grouped = items
    .filter((i) => {
      if (filterStatus === "low") return stockStatus(i) === "low";
      if (filterStatus === "out") return stockStatus(i) === "out";
      if (search) return i.name.toLowerCase().includes(search.toLowerCase()) || i.category.toLowerCase().includes(search.toLowerCase());
      return true;
    })
    .reduce((acc, item) => {
      (acc[item.category] = acc[item.category] ?? []).push(item);
      return acc;
    }, {} as Record<string, InventoryItem[]>);

  const outCount  = items.filter((i) => stockStatus(i) === "out").length;
  const lowCount  = items.filter((i) => stockStatus(i) === "low").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center">
          <div className="text-5xl animate-pulse mb-4">📦</div>
          <p className="text-slate-500">Loading inventory…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Inventory</h1>
          <p className="text-slate-500 text-sm">{items.length} items · {outCount > 0 && <span className="text-red-600 font-semibold">{outCount} out of stock</span>}{outCount > 0 && lowCount > 0 && " · "}{lowCount > 0 && <span className="text-amber-600 font-semibold">{lowCount} low</span>}</p>
        </div>
        <button
          onClick={() => { setShowAdd(true); setError(""); }}
          className="bg-amber-500 hover:bg-amber-600 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors"
        >
          + Add Item
        </button>
      </div>

      {/* Alert banner */}
      {(outCount > 0 || lowCount > 0) && (
        <div className={`mb-5 rounded-xl px-5 py-4 flex items-center gap-3 ${outCount > 0 ? "bg-red-50 border border-red-200" : "bg-amber-50 border border-amber-200"}`}>
          <span className="text-2xl">{outCount > 0 ? "🚨" : "⚠️"}</span>
          <div className="flex-1">
            {outCount > 0 && <p className="text-red-700 font-bold text-sm">{outCount} item{outCount > 1 ? "s" : ""} out of stock</p>}
            {lowCount > 0 && <p className="text-amber-700 text-sm">{lowCount} item{lowCount > 1 ? "s" : ""} running low</p>}
          </div>
          <div className="flex gap-2">
            {outCount > 0 && <button onClick={() => setFilterStatus("out")} className="text-xs bg-red-600 text-white px-3 py-1 rounded-lg">View Out</button>}
            {lowCount > 0 && <button onClick={() => setFilterStatus("low")} className="text-xs bg-amber-500 text-white px-3 py-1 rounded-lg">View Low</button>}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {(["all", "low", "out"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilterStatus(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${filterStatus === f ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            {f === "all" ? "All Items" : f === "low" ? "⚠️ Low Stock" : "🚨 Out of Stock"}
          </button>
        ))}
        <div className="relative ml-auto w-48">
          <input
            ref={invSearchRef}
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setFilterStatus("all"); setInvSugIdx(-1); }}
            onKeyDown={(e) => handleSuggestionKey(e, invSuggestions.length, invSugIdx, setInvSugIdx,
              (idx) => { setSearch(invSuggestions[idx].primary); setInvSugIdx(-1); invSearchRef.current?.focus(); },
              () => { setSearch(""); setInvSugIdx(-1); }
            )}
            placeholder="Search…"
            autoComplete="off"
            className="w-full border border-slate-200 rounded-xl px-4 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <SuggestionDropdown suggestions={invSuggestions} activeIdx={invSugIdx}
            onSelect={(s) => { setSearch(s.primary); setInvSugIdx(-1); }} />
        </div>
      </div>

      {/* Add Item Form */}
      {showAdd && (
        <div className="mb-6 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h2 className="font-bold text-slate-800 mb-4">New Inventory Item</h2>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2 mb-4">{error}</div>}
          <form onSubmit={handleAdd} className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Item Name *</label>
              <input type="text" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Tomatoes" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Category</label>
              <input type="text" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="e.g. Vegetables" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Current Qty</label>
              <input type="number" min="0" step="any" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Unit</label>
              <select value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white">
                {UNITS.map((u) => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Low Stock Alert Threshold</label>
              <input type="number" min="0" step="any" value={form.minStock} onChange={(e) => setForm((f) => ({ ...f, minStock: e.target.value }))}
                placeholder="0 = no alert" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div className="flex items-end gap-2">
              <button type="submit" disabled={saving} className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-bold py-2 rounded-lg text-sm transition-colors">
                {saving ? "Adding…" : "Add Item"}
              </button>
              <button type="button" onClick={() => { setShowAdd(false); setError(""); }} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 rounded-lg text-sm">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {adjustId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setAdjustId(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="font-bold text-slate-800 text-lg mb-1">Adjust Stock</h2>
            <p className="text-slate-500 text-sm mb-5">{items.find((i) => i.id === adjustId)?.name}</p>
            <form onSubmit={handleAdjust} className="space-y-4">
              <div className="flex gap-2">
                {(["IN", "OUT", "ADJUSTMENT"] as const).map((t) => (
                  <button type="button" key={t} onClick={() => setAdjustForm((f) => ({ ...f, type: t }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-colors ${adjustForm.type === t
                      ? t === "IN" ? "bg-green-500 text-white border-green-500"
                      : t === "OUT" ? "bg-red-500 text-white border-red-500"
                      : "bg-blue-500 text-white border-blue-500"
                      : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"}`}>
                    {t === "IN" ? "➕ Stock In" : t === "OUT" ? "➖ Stock Out" : "✏️ Adjust"}
                  </button>
                ))}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Quantity {adjustForm.type === "OUT" ? "to remove" : adjustForm.type === "IN" ? "to add" : "set change"} *
                </label>
                <input type="number" min="0.01" step="any" required value={adjustForm.change}
                  onChange={(e) => setAdjustForm((f) => ({ ...f, change: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Note (optional)</label>
                <input type="text" value={adjustForm.note}
                  onChange={(e) => setAdjustForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder="e.g. Received from vendor, Used for lunch service…"
                  className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={adjusting}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-400 text-white font-bold py-3 rounded-xl transition-colors">
                  {adjusting ? "Saving…" : "Save"}
                </button>
                <button type="button" onClick={() => setAdjustId(null)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-3 rounded-xl">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inventory table by category */}
      {Object.keys(grouped).length === 0 ? (
        <div className="text-center py-24 text-slate-400">
          <div className="text-5xl mb-3">📦</div>
          <p className="text-lg">No items found</p>
          <button onClick={() => { setShowAdd(true); setFilterStatus("all"); setSearch(""); }}
            className="mt-4 bg-amber-500 hover:bg-amber-600 text-white font-semibold px-6 py-2.5 rounded-xl">
            Add your first item
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([category, catItems]) => (
            <div key={category} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="bg-slate-50 border-b border-slate-100 px-5 py-3 flex items-center justify-between">
                <h3 className="font-bold text-slate-700">{category}</h3>
                <span className="text-xs text-slate-400">{catItems.length} item{catItems.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="divide-y divide-slate-50">
                {catItems.map((item) => {
                  const st = stockStatus(item);
                  const styles = STATUS_STYLES[st];
                  const pct = item.minStock > 0 ? Math.min(100, (item.quantity / (item.minStock * 3)) * 100) : null;
                  return (
                    <div key={item.id}>
                      <div className="px-5 py-4 flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-slate-800">{item.name}</p>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles.badge}`}>
                              {styles.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <p className="text-sm text-slate-600">
                              <span className="font-bold text-slate-800 text-base">{item.quantity}</span>
                              <span className="ml-1 text-slate-400">{item.unit}</span>
                            </p>
                            {item.minStock > 0 && (
                              <p className="text-xs text-slate-400">min: {item.minStock} {item.unit}</p>
                            )}
                          </div>
                          {pct !== null && (
                            <div className="mt-2 h-1.5 bg-slate-100 rounded-full w-40 overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${styles.bar}`} style={{ width: `${pct}%` }} />
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => { setAdjustId(item.id); setAdjustForm({ type: "IN", change: "", note: "" }); }}
                            className="bg-green-100 hover:bg-green-200 text-green-700 font-bold text-xs px-3 py-1.5 rounded-lg transition-colors"
                          >
                            ➕
                          </button>
                          <button
                            onClick={() => { setAdjustId(item.id); setAdjustForm({ type: "OUT", change: "", note: "" }); }}
                            className="bg-red-100 hover:bg-red-200 text-red-700 font-bold text-xs px-3 py-1.5 rounded-lg transition-colors"
                          >
                            ➖
                          </button>
                          <button
                            onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs px-3 py-1.5 rounded-lg transition-colors"
                          >
                            {expandedId === item.id ? "▲" : "📋"}
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="text-slate-300 hover:text-red-500 transition-colors text-lg px-1"
                          >
                            ×
                          </button>
                        </div>
                      </div>

                      {/* Expanded log */}
                      {expandedId === item.id && (
                        <div className="px-5 pb-4 border-t border-slate-50 bg-slate-50/50">
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide my-3">Recent Activity</p>
                          {item.logs.length === 0 ? (
                            <p className="text-sm text-slate-400">No activity yet</p>
                          ) : (
                            <div className="space-y-2">
                              {item.logs.map((log) => (
                                <div key={log.id} className="flex items-center justify-between text-sm">
                                  <div className="flex items-center gap-2">
                                    <span className={`font-bold ${log.change > 0 ? "text-green-600" : "text-red-600"}`}>
                                      {log.change > 0 ? "+" : ""}{log.change} {item.unit}
                                    </span>
                                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                                      log.type === "IN" ? "bg-green-100 text-green-700"
                                      : log.type === "OUT" ? "bg-red-100 text-red-700"
                                      : "bg-blue-100 text-blue-700"}`}>
                                      {log.type}
                                    </span>
                                    {log.note && <span className="text-slate-500 text-xs">{log.note}</span>}
                                  </div>
                                  <span className="text-slate-400 text-xs">
                                    {new Date(log.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

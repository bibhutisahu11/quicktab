"use client";

import { useEffect, useState } from "react";
import { DiscountData, DiscountType, DiscountScope } from "@/types";
import { DAY_NAMES } from "@/lib/discountEngine";

const SCOPE_LABELS: Record<DiscountScope, string> = {
  ALL:        "All Orders",
  DAYS:       "Specific Days Only",
  ITEMS:      "Specific Menu Items",
  CATEGORIES: "Specific Categories",
  CATEGORY:   "Specific Categories",
};

const EMPTY_FORM = {
  name: "",
  description: "",
  type: "PERCENTAGE" as DiscountType,
  value: "",
  scope: "ALL" as DiscountScope,
  itemIds: [] as string[],
  categories: [] as string[],
  daysOfWeek: [] as number[],
  minOrder: "",
  validFrom: "",
  validTo: "",
  active: true,
};

interface MenuItemOption { id: string; name: string; category: string; }

export default function DiscountManager() {
  const [discounts, setDiscounts] = useState<DiscountData[]>([]);
  const [loading, setLoading]     = useState(true);
  const [formOpen, setFormOpen]   = useState(false);
  const [editId, setEditId]       = useState<string | null>(null);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItemOption[]>([]);
  const [catInput, setCatInput]   = useState("");

  async function fetchAll() {
    const [dr, mr] = await Promise.all([
      fetch("/api/admin/discounts"),
      fetch("/api/menu"),
    ]);
    if (dr.ok) setDiscounts(await dr.json());
    if (mr.ok) setMenuItems(await mr.json());
    setLoading(false);
  }

  useEffect(() => { fetchAll(); }, []);

  function openCreate() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setCatInput("");
    setFormOpen(true);
  }

  function openEdit(d: DiscountData) {
    setEditId(d.id);
    setForm({
      name:        d.name,
      description: d.description ?? "",
      type:        d.type,
      value:       String(d.value),
      scope:       d.scope,
      itemIds:     d.itemIds,
      categories:  d.categories,
      daysOfWeek:  d.daysOfWeek,
      minOrder:    d.minOrder ? String(d.minOrder) : "",
      validFrom:   d.validFrom ? d.validFrom.slice(0, 10) : "",
      validTo:     d.validTo   ? d.validTo.slice(0, 10)   : "",
      active:      d.active,
    });
    setCatInput(d.categories.join(", "));
    setFormOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      value:    parseFloat(form.value) || 0,
      minOrder: form.minOrder ? parseFloat(form.minOrder) : null,
      validFrom: form.validFrom || null,
      validTo:   form.validTo   || null,
      categories: catInput.split(",").map((c) => c.trim()).filter(Boolean),
    };
    const url    = editId ? `/api/admin/discounts/${editId}` : "/api/admin/discounts";
    const method = editId ? "PATCH" : "POST";
    const res    = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (res.ok) { await fetchAll(); setFormOpen(false); }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this discount?")) return;
    setDeletingId(id);
    await fetch(`/api/admin/discounts/${id}`, { method: "DELETE" });
    setDiscounts((prev) => prev.filter((d) => d.id !== id));
    setDeletingId(null);
  }

  async function toggleActive(d: DiscountData) {
    const res = await fetch(`/api/admin/discounts/${d.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !d.active }),
    });
    if (res.ok) setDiscounts((prev) => prev.map((x) => x.id === d.id ? { ...x, active: !d.active } : x));
  }

  function toggleDay(d: number) {
    setForm((f) => ({
      ...f,
      daysOfWeek: f.daysOfWeek.includes(d) ? f.daysOfWeek.filter((x) => x !== d) : [...f.daysOfWeek, d],
    }));
  }

  function toggleItemId(id: string) {
    setForm((f) => ({
      ...f,
      itemIds: f.itemIds.includes(id) ? f.itemIds.filter((x) => x !== id) : [...f.itemIds, id],
    }));
  }

  const categories = Array.from(new Set(menuItems.map((m) => m.category))).sort();

  if (loading) return (
    <div className="p-6 animate-pulse space-y-3">
      <div className="h-8 bg-slate-200 rounded w-48" />
      <div className="h-24 bg-slate-200 rounded" />
    </div>
  );

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Discounts</h1>
          <p className="text-slate-500 text-sm">Auto-applied to customer orders based on rules</p>
        </div>
        <button
          onClick={openCreate}
          className="bg-amber-500 hover:bg-amber-600 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors"
        >
          + New Discount
        </button>
      </div>

      {/* List */}
      {discounts.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <div className="text-5xl mb-3">🏷️</div>
          <p className="text-lg font-medium">No discounts yet</p>
          <p className="text-sm">Create one to auto-apply savings at checkout</p>
        </div>
      ) : (
        <div className="space-y-3">
          {discounts.map((d) => (
            <div key={d.id} className={`bg-white rounded-2xl border-2 p-4 transition-all ${d.active ? "border-slate-200" : "border-slate-100 opacity-60"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-800">{d.name}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${d.type === "PERCENTAGE" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                      {d.type === "PERCENTAGE" ? `${d.value}% OFF` : `₹${d.value} OFF`}
                    </span>
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{SCOPE_LABELS[d.scope]}</span>
                    {!d.active && <span className="text-xs bg-red-100 text-red-500 px-2 py-0.5 rounded-full">Inactive</span>}
                  </div>
                  {d.description && <p className="text-sm text-slate-500 mt-0.5">{d.description}</p>}
                  <div className="flex gap-3 mt-1.5 flex-wrap text-xs text-slate-400">
                    {d.daysOfWeek.length > 0 && (
                      <span>📅 {d.daysOfWeek.map((x) => DAY_NAMES[x]).join(", ")}</span>
                    )}
                    {d.minOrder && <span>Min ₹{d.minOrder}</span>}
                    {d.validFrom && <span>From {new Date(d.validFrom).toLocaleDateString()}</span>}
                    {d.validTo   && <span>Until {new Date(d.validTo).toLocaleDateString()}</span>}
                    {d.categories.length > 0 && <span>🍴 {d.categories.join(", ")}</span>}
                    {d.itemIds.length > 0 && <span>📋 {d.itemIds.length} item{d.itemIds.length > 1 ? "s" : ""}</span>}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => toggleActive(d)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${d.active ? "border-slate-200 text-slate-600 hover:bg-slate-50" : "border-green-200 text-green-600 hover:bg-green-50"}`}
                  >
                    {d.active ? "Deactivate" : "Activate"}
                  </button>
                  <button onClick={() => openEdit(d)} className="text-xs text-blue-600 hover:text-blue-700 font-semibold px-2 py-1.5">Edit</button>
                  <button
                    onClick={() => handleDelete(d.id)}
                    disabled={deletingId === d.id}
                    className="text-xs text-red-500 hover:text-red-600 font-semibold px-2 py-1.5 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Create / Edit Form Modal ────────────────────────────────────── */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl">
              <h2 className="text-lg font-bold text-slate-800">{editId ? "Edit Discount" : "New Discount"}</h2>
              <button onClick={() => setFormOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500">✕</button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-5">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Discount Name *</label>
                <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Monday Special, Happy Hours"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Shown to customer at checkout"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>

              {/* Type + Value */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Type *</label>
                  <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as DiscountType }))}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FLAT">Flat amount (₹)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Value * {form.type === "PERCENTAGE" ? "(e.g. 10 for 10%)" : "(₹ amount)"}
                  </label>
                  <input required type="number" min="0" step="0.01" value={form.value}
                    onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
              </div>

              {/* Scope */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Applies To *</label>
                <select value={form.scope} onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value as DiscountScope }))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
                  {(Object.keys(SCOPE_LABELS) as DiscountScope[]).map((s) => (
                    <option key={s} value={s}>{SCOPE_LABELS[s]}</option>
                  ))}
                </select>
              </div>

              {/* Days picker */}
              {(form.scope === "DAYS" || form.daysOfWeek.length > 0) && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Active Days</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {DAY_NAMES.map((day, idx) => (
                      <button key={idx} type="button" onClick={() => toggleDay(idx)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${form.daysOfWeek.includes(idx) ? "bg-amber-500 border-amber-500 text-white" : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"}`}>
                        {day}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Leave empty = every day</p>
                </div>
              )}

              {/* Categories */}
              {form.scope === "CATEGORIES" && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Categories (comma-separated)</label>
                  <input value={catInput} onChange={(e) => setCatInput(e.target.value)}
                    placeholder="e.g. Starters, Beverages"
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                  {categories.length > 0 && (
                    <div className="flex gap-1 flex-wrap mt-2">
                      {categories.map((c) => (
                        <button key={c} type="button"
                          onClick={() => setCatInput((prev) => {
                            const arr = prev.split(",").map((x) => x.trim()).filter(Boolean);
                            return arr.includes(c) ? arr.filter((x) => x !== c).join(", ") : [...arr, c].join(", ");
                          })}
                          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${catInput.split(",").map((x) => x.trim()).includes(c) ? "bg-amber-500 text-white border-amber-500" : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"}`}>
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Specific items */}
              {form.scope === "ITEMS" && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Select Items</label>
                  <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                    {menuItems.map((item) => (
                      <label key={item.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50">
                        <input type="checkbox" checked={form.itemIds.includes(item.id)} onChange={() => toggleItemId(item.id)}
                          className="rounded border-slate-300 text-amber-500 focus:ring-amber-400" />
                        <span className="text-sm text-slate-700 flex-1">{item.name}</span>
                        <span className="text-xs text-slate-400">{item.category}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Min order */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Minimum Order Amount (₹) — optional</label>
                <input type="number" min="0" value={form.minOrder} onChange={(e) => setForm((f) => ({ ...f, minOrder: e.target.value }))}
                  placeholder="e.g. 200"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>

              {/* Date range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Valid From</label>
                  <input type="date" value={form.validFrom} onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Valid Until</label>
                  <input type="date" value={form.validTo} onChange={(e) => setForm((f) => ({ ...f, validTo: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
              </div>

              {/* Active toggle */}
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setForm((f) => ({ ...f, active: !f.active }))}
                  className={`w-11 h-6 rounded-full transition-colors relative ${form.active ? "bg-amber-500" : "bg-slate-200"}`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.active ? "translate-x-5" : ""}`} />
                </div>
                <span className="text-sm font-medium text-slate-700">Active</span>
              </label>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setFormOpen(false)}
                  className="flex-1 border border-slate-200 text-slate-600 font-semibold py-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-semibold py-2.5 rounded-xl transition-colors">
                  {saving ? "Saving..." : editId ? "Save Changes" : "Create Discount"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { MenuItemData, OrderData } from "@/types";

interface CartRow {
  item: MenuItemData;
  qty: number;
  notes?: string;
  customGrams?: number;
  customPrice?: number;
}

interface Props {
  order: OrderData;
  onClose: () => void;
  onAdded: (updated: OrderData) => void;
}

export default function AddItemsModal({ order, onClose, onAdded }: Props) {
  const [menuItems, setMenuItems] = useState<MenuItemData[]>([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartRow[]>([]);
  const [gramInputs, setGramInputs] = useState<Record<string, string>>({});
  const [notesInputs, setNotesInputs] = useState<Record<string, string>>({});
  const [suggestionIdx, setSuggestionIdx] = useState(-1);
  const searchRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/menu")
      .then((r) => r.ok ? r.json() : [])
      .then((data: MenuItemData[]) => setMenuItems(data.filter((m) => m.available)))
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return menuItems;
    const hay = (m: { name: string; category: string }) =>
      `${m.name} ${m.category}`.toLowerCase();
    const t1 = menuItems.filter((m) => hay(m).includes(q));
    if (t1.length) return t1;
    const words = q.split(/\s+/).filter(Boolean);
    const t2 = menuItems.filter((m) => words.every((w) => hay(m).includes(w)));
    if (t2.length) return t2;
    return menuItems.filter((m) => words.some((w) => hay(m).includes(w)));
  }, [menuItems, search]);

  const grouped = useMemo(() => {
    const map: Record<string, MenuItemData[]> = {};
    filtered.forEach((m) => { (map[m.category] ??= []).push(m); });
    return map;
  }, [filtered]);

  const suggestions = useMemo(
    () => (search.trim() ? filtered.slice(0, 8) : []),
    [filtered, search]
  );

  const acceptSuggestion = useCallback((item: MenuItemData) => {
    if (item.unit !== "100g") {
      setCart((prev) => {
        const ex = prev.find((r) => r.item.id === item.id);
        if (ex) return prev.map((r) => r.item.id === item.id ? { ...r, qty: r.qty + 1 } : r);
        return [...prev, { item, qty: 1 }];
      });
    }
    setSearch("");
    setSuggestionIdx(-1);
    searchRef.current?.focus();
  }, []);

  function getQty(itemId: string) {
    return cart.find((r) => r.item.id === itemId)?.qty ?? 0;
  }

  function setQty(item: MenuItemData, qty: number) {
    if (qty <= 0) {
      setCart((prev) => prev.filter((r) => r.item.id !== item.id));
    } else {
      setCart((prev) => {
        const existing = prev.find((r) => r.item.id === item.id);
        if (existing) return prev.map((r) => r.item.id === item.id ? { ...r, qty } : r);
        return [...prev, { item, qty }];
      });
    }
  }

  function addWeightItem(item: MenuItemData) {
    const grams = parseFloat(gramInputs[item.id] ?? "");
    if (!grams || grams <= 0) return;
    const pricePerKg = item.price * 10;
    const calculatedPrice = Math.ceil((grams / 1000) * pricePerKg);
    setCart((prev) => {
      const existing = prev.find((r) => r.item.id === item.id);
      if (existing) {
        const totalGrams = (existing.customGrams ?? 0) + grams;
        const newPrice = Math.ceil((totalGrams / 1000) * pricePerKg);
        return prev.map((r) =>
          r.item.id === item.id ? { ...r, customGrams: totalGrams, customPrice: newPrice } : r
        );
      }
      return [...prev, { item, qty: 1, customGrams: grams, customPrice: calculatedPrice }];
    });
    setGramInputs((prev) => ({ ...prev, [item.id]: "" }));
  }

  const addTotal = cart.reduce((s, r) => s + (r.customPrice ?? r.item.price * r.qty), 0);

  async function handleSubmit() {
    if (cart.length === 0) { setError("Add at least one item"); return; }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/orders/${order.id}/add-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((r) => ({
            menuItemId: r.item.id,
            name: r.item.unit === "100g" && r.customGrams
              ? `${r.item.name} (${r.customGrams}g)`
              : r.item.name,
            price: r.customPrice !== undefined ? r.customPrice : r.item.price * r.qty,
            quantity: r.item.unit === "100g" ? 1 : r.qty,
            notes: notesInputs[r.item.id] || undefined,
          })),
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        onAdded(updated);
      } else {
        const data = await res.json();
        setError(data.error ?? "Failed to add items");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh] rounded-t-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <h2 className="text-lg font-black text-slate-800">+ Add Items to Order</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              #{order.id.slice(-6).toUpperCase()} · {order.customerName}
              {order.table ? ` · ${order.table.name}` : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-2xl leading-none w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
          >
            ×
          </button>
        </div>

        {/* Existing items summary */}
        <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 flex-shrink-0">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Existing items</p>
          <p className="text-sm text-slate-700 leading-relaxed">
            {order.items.map((i) => `${i.name} ×${i.quantity}`).join(" · ")}
          </p>
          <p className="text-xs text-slate-500 mt-1">Current total: <span className="font-bold text-slate-700">₹{order.total.toFixed(0)}</span></p>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-slate-100 flex-shrink-0">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">🔍</span>
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSuggestionIdx(-1); }}
              onKeyDown={(e) => {
                if (!suggestions.length) return;
                if (e.key === "ArrowDown") { e.preventDefault(); setSuggestionIdx((i) => Math.min(i + 1, suggestions.length - 1)); }
                else if (e.key === "ArrowUp") { e.preventDefault(); setSuggestionIdx((i) => Math.max(i - 1, 0)); }
                else if (e.key === "Enter" && suggestionIdx >= 0) { e.preventDefault(); acceptSuggestion(suggestions[suggestionIdx]); }
                else if (e.key === "Escape") { setSearch(""); setSuggestionIdx(-1); }
              }}
              placeholder="Search items or categories…"
              autoFocus
              autoComplete="off"
              style={{ colorScheme: "light" }}
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            {/* Suggestions dropdown */}
            {suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                {suggestions.map((item, idx) => {
                  const inCart = cart.find((r) => r.item.id === item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); acceptSuggestion(item); }}
                      className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors ${
                        idx === suggestionIdx ? "bg-amber-50" : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-semibold text-slate-800 truncate">{item.name}</span>
                        <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full flex-shrink-0">{item.category}</span>
                        {inCart && <span className="text-xs text-amber-600 font-bold flex-shrink-0">×{inCart.qty}</span>}
                      </div>
                      <span className="text-xs font-bold text-slate-600 flex-shrink-0 ml-2">
                        {item.unit === "100g" ? `₹${item.price * 10}/kg` : `₹${item.price}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Menu items list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {Object.keys(grouped).length === 0 && (
            <p className="text-center text-slate-400 py-8 text-sm">No items found</p>
          )}
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">{cat}</p>
              <div className="space-y-2">
                {items.map((item) => {
                  const qty = getQty(item.id);
                  const isWeight = item.unit === "100g";
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border transition-colors ${qty > 0 ? "border-amber-300 bg-amber-50" : "border-slate-100 bg-slate-50"}`}
                    >
                      {/* Veg/non-veg dot */}
                      <span className={`flex-shrink-0 inline-flex w-3.5 h-3.5 rounded-sm border-2 items-center justify-center ${item.isVeg ? "border-green-600" : "border-red-600"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${item.isVeg ? "bg-green-600" : "bg-red-600"}`} />
                      </span>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{item.name}</p>
                        <p className="text-xs text-slate-500">₹{item.price}{isWeight ? "/100g" : ""}</p>

                        {/* Notes input (when item is in cart) */}
                        {qty > 0 && (
                          <input
                            type="text"
                            value={notesInputs[item.id] ?? ""}
                            onChange={(e) => setNotesInputs((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            placeholder="Note (e.g. spicy, less oil)"
                            className="mt-1.5 w-full text-xs text-slate-800 bg-white placeholder-slate-400 border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-amber-400"
                          />
                        )}
                      </div>

                      {/* Weight-based input */}
                      {isWeight ? (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <input
                            type="number"
                            min="10"
                            step="10"
                            value={gramInputs[item.id] ?? ""}
                            onChange={(e) => setGramInputs((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            placeholder="gm"
                            className="w-16 text-xs text-slate-800 bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-400 text-center"
                          />
                          <button
                            onClick={() => addWeightItem(item)}
                            className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-2 py-1.5 rounded-lg transition-colors"
                          >
                            Add
                          </button>
                        </div>
                      ) : (
                        /* Qty stepper */
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {qty > 0 ? (
                            <>
                              <button
                                onClick={() => setQty(item, qty - 1)}
                                className="w-7 h-7 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-700 font-bold text-base flex items-center justify-center transition-colors"
                              >
                                −
                              </button>
                              <span className="w-6 text-center text-sm font-bold text-slate-800">{qty}</span>
                              <button
                                onClick={() => setQty(item, qty + 1)}
                                className="w-7 h-7 rounded-full bg-amber-500 hover:bg-amber-600 text-white font-bold text-base flex items-center justify-center transition-colors"
                              >
                                +
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setQty(item, 1)}
                              className="w-7 h-7 rounded-full bg-amber-500 hover:bg-amber-600 text-white font-bold text-xl flex items-center justify-center transition-colors"
                            >
                              +
                            </button>
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

        {/* Footer — cart summary + confirm (sticky so always visible) */}
        <div className="sticky bottom-0 px-5 py-4 border-t border-slate-100 bg-white flex-shrink-0 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
          {error && (
            <p className="text-sm text-red-600 font-medium mb-3 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Cart summary — always visible regardless of search query */}
          {cart.length > 0 && (
            <div className="mb-3 bg-amber-50 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Adding to order</p>
              <div className="space-y-2">
                {cart.map((r) => (
                  <div key={r.item.id} className="flex items-center gap-2 text-sm">
                    <span className="flex-1 text-slate-700 truncate">
                      {r.item.unit === "100g" && r.customGrams
                        ? `${r.item.name} (${r.customGrams}g)`
                        : r.item.name}
                    </span>
                    {r.item.unit !== "100g" && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => setQty(r.item, r.qty - 1)}
                          className="w-6 h-6 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-700 font-bold text-sm flex items-center justify-center transition-colors"
                        >−</button>
                        <span className="w-5 text-center font-bold text-slate-800">{r.qty}</span>
                        <button
                          onClick={() => setQty(r.item, r.qty + 1)}
                          className="w-6 h-6 rounded-full bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm flex items-center justify-center transition-colors"
                        >+</button>
                      </div>
                    )}
                    <span className="font-semibold text-slate-800 flex-shrink-0 w-14 text-right">
                      ₹{(r.customPrice ?? r.item.price * r.qty).toFixed(0)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="border-t border-amber-200 mt-2 pt-2 flex justify-between text-sm font-bold">
                <span className="text-slate-700">New total after adding</span>
                <span className="text-amber-700">₹{(order.total + addTotal).toFixed(0)}</span>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleSubmit}
              disabled={submitting || cart.length === 0}
              className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors text-sm"
            >
              {submitting ? "Adding…" : cart.length === 0 ? "Select items to add" : `✅ Add ${cart.length} item${cart.length > 1 ? "s" : ""} · +₹${addTotal.toFixed(0)}`}
            </button>
            <button
              onClick={onClose}
              className="px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 rounded-xl transition-colors text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

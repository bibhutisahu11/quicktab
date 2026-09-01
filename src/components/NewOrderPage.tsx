"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import SuggestionDropdown, { Suggestion, handleSuggestionKey } from "./SuggestionDropdown";
import { MenuItemData } from "@/types";

interface Table { id: string; name: string; }
interface CartRow { item: MenuItemData; qty: number; customGrams?: number; customPrice?: number; }

export default function NewOrderPage({ orgSlug }: { orgSlug: string }) {
  const [menuItems, setMenuItems] = useState<MenuItemData[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartRow[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [orderType, setOrderType] = useState<"TABLE" | "PARCEL">("TABLE");
  const [tableId, setTableId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "UPI">("CASH");
  const [parcelCharge, setParcelCharge] = useState<0 | 5 | 10>(0);
  const [suggestionIdx, setSuggestionIdx] = useState(-1);
  const searchRef = useRef<HTMLInputElement>(null);
  const [discountInput, setDiscountInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successOrderId, setSuccessOrderId] = useState<string | null>(null);
  const [gramInputs, setGramInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/menu")
      .then((r) => r.ok ? r.json() : [])
      .then((data: MenuItemData[]) => setMenuItems(data.filter((m) => m.available)))
      .catch(() => {});
    fetch("/api/admin/tables")
      .then((r) => r.ok ? r.json() : { tables: [] })
      .then((data: { tables: Table[] }) => {
        const list = data.tables ?? [];
        setTables(list);
        if (list.length > 0) setTableId(list[0].id);
      })
      .catch(() => {});
  }, []);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return menuItems;
    const haystack = (m: MenuItemData) =>
      `${m.name} ${m.category} ${(m as MenuItemData & { description?: string }).description ?? ""}`.toLowerCase();
    const t1 = menuItems.filter((m) => haystack(m).includes(q));
    if (t1.length) return t1;
    const words = q.split(/\s+/).filter(Boolean);
    const t2 = menuItems.filter((m) => words.every((w) => haystack(m).includes(w)));
    if (t2.length) return t2;
    return menuItems.filter((m) => words.some((w) => haystack(m).includes(w)));
  }, [menuItems, search]);

  const grouped = useMemo(() => {
    const map: Record<string, MenuItemData[]> = {};
    filteredItems.forEach((m) => { (map[m.category] ??= []).push(m); });
    return map;
  }, [filteredItems]);

  // Auto-suggestions: top 8 matches when search is active
  const suggestions: Suggestion[] = useMemo(
    () => search.trim()
      ? filteredItems.slice(0, 8).map((m) => ({
          id: m.id,
          primary: m.name,
          secondary: m.category,
          meta: m.unit === "100g" ? `₹${m.price * 10}/kg` : `₹${m.price}`,
          badge: cart.find((r) => r.item.id === m.id) ? `×${cart.find((r) => r.item.id === m.id)!.qty}` : undefined,
        }))
      : [],
    [filteredItems, search, cart]
  );

  const acceptSuggestion = useCallback((s: Suggestion) => {
    const item = menuItems.find((m) => m.id === s.id);
    if (!item || item.unit === "100g") { setSearch(""); setSuggestionIdx(-1); return; }
    setQty(item, (cart.find((r) => r.item.id === item.id)?.qty ?? 0) + 1);
    setSearch(""); setSuggestionIdx(-1);
    searchRef.current?.focus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuItems, cart]);

  function setQty(item: MenuItemData, qty: number) {
    if (qty <= 0) setCart((p) => p.filter((r) => r.item.id !== item.id));
    else setCart((p) => {
      const ex = p.find((r) => r.item.id === item.id);
      if (ex) return p.map((r) => r.item.id === item.id ? { ...r, qty } : r);
      return [...p, { item, qty }];
    });
  }
  function getQty(id: string) { return cart.find((r) => r.item.id === id)?.qty ?? 0; }

  function addWeightItem(item: MenuItemData) {
    const grams = parseFloat(gramInputs[item.id] ?? "");
    if (!grams || grams <= 0) return;
    const pricePerKg = item.price * 10;
    const calcPrice = Math.ceil((grams / 1000) * pricePerKg);
    setCart((p) => {
      const ex = p.find((r) => r.item.id === item.id);
      if (ex) {
        const total = (ex.customGrams ?? 0) + grams;
        return p.map((r) => r.item.id === item.id ? { ...r, customGrams: total, customPrice: Math.ceil((total / 1000) * pricePerKg) } : r);
      }
      return [...p, { item, qty: 1, customGrams: grams, customPrice: calcPrice }];
    });
    setGramInputs((p) => ({ ...p, [item.id]: "" }));
  }

  const subtotal = cart.reduce((s, r) => s + (r.customPrice ?? r.item.price * r.qty), 0);
  const discountAmt = Math.min(Math.max(parseFloat(discountInput) || 0, 0), subtotal);
  const total = subtotal - discountAmt + (orderType === "PARCEL" ? parcelCharge : 0);

  function resetForm() {
    setCart([]); setCustomerName(""); setPhone(""); setNotes("");
    setOrderType("TABLE"); setDiscountInput(""); setParcelCharge(0);
    setSearch(""); setSuccessOrderId(null); setError("");
    if (tables.length > 0) setTableId(tables[0].id);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerName.trim()) { setError("Customer name is required"); return; }
    if (cart.length === 0) { setError("Add at least one item"); return; }
    if (orderType === "TABLE" && !tableId) { setError("Select a table"); return; }

    const hasDahipani = cart.some((r) => r.item.name.toLowerCase().includes("dahipani"));
    const hasAloodum = cart.some((r) => ["dahibara", "aloodum", "aloo dum"].some((k) => r.item.name.toLowerCase().includes(k)));
    if (hasDahipani && !hasAloodum) {
      setError("🚫 Dahipani can only be added with Dahibara Aloodum.");
      return;
    }

    setError(""); setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: orderType,
          ...(orderType === "TABLE" ? { tableId } : { orgSlug }),
          customerName: customerName.trim(),
          phone: phone.trim() || undefined,
          notes: notes.trim() || undefined,
          paymentMethod,
          parcelCharge: orderType === "PARCEL" ? parcelCharge : 0,
          discountAmount: discountAmt > 0 ? discountAmt : undefined,
          adminCreated: true,
          items: cart.map((r) => ({
            menuItemId: r.item.id,
            quantity: r.qty,
            ...(r.customGrams ? { customGrams: r.customGrams, notes: `${r.customGrams}g` } : {}),
          })),
        }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "Failed"); return; }
      const order = await res.json();
      setSuccessOrderId(order.id ?? "OK");
    } catch { setError("Network error. Please try again."); }
    finally { setSubmitting(false); }
  }

  if (successOrderId) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center space-y-4">
          <div className="text-5xl">✅</div>
          <h2 className="text-2xl font-bold text-slate-800">Order Placed!</h2>
          <p className="text-slate-500 text-sm">Order <span className="font-mono font-bold text-amber-600">{successOrderId}</span> created for <span className="font-semibold">{customerName}</span></p>
          <p className="text-2xl font-bold text-slate-800">₹{total.toFixed(0)}</p>
          <div className="flex flex-col gap-2 pt-2">
            <button onClick={resetForm} className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl transition-colors">
              ➕ New Order
            </button>
            <button onClick={() => window.close()} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 rounded-xl transition-colors text-sm">
              Close Tab
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="bg-amber-500 text-white px-6 py-4 flex items-center justify-between shadow-md flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => window.close()} className="w-8 h-8 bg-amber-400/50 hover:bg-amber-400 rounded-full flex items-center justify-center font-bold transition-colors text-sm">
            ✕
          </button>
          <div>
            <h1 className="text-lg font-bold">➕ New Order</h1>
            <p className="text-amber-100 text-xs">Admin · Counter Order</p>
          </div>
        </div>
        {cart.length > 0 && (
          <div className="bg-amber-400/60 px-3 py-1.5 rounded-xl text-sm font-bold">
            {cart.length} item{cart.length !== 1 ? "s" : ""} · ₹{total.toFixed(0)}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <form id="new-order-form" onSubmit={handleSubmit} className="max-w-2xl mx-auto px-4 py-4 space-y-4 pb-48">

          {/* Customer details */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 space-y-3">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide">Customer Details</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Name *</label>
                <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Walk-in Customer" autoComplete="off"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Phone</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                  placeholder="Optional" autoComplete="off"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Order Type</label>
                <div className="flex rounded-lg border border-slate-300 overflow-hidden">
                  {(["TABLE", "PARCEL"] as const).map((t) => (
                    <button key={t} type="button" onClick={() => setOrderType(t)}
                      className={`flex-1 py-2 text-sm font-medium transition-colors ${orderType === t ? "bg-amber-500 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
                      {t === "TABLE" ? "🍽️ Dine-in" : "📦 Parcel"}
                    </button>
                  ))}
                </div>
              </div>
              {orderType === "TABLE" ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Table</label>
                  <select value={tableId} onChange={(e) => setTableId(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400">
                    {tables.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Parcel Charge</label>
                  <div className="flex rounded-lg border border-slate-300 overflow-hidden">
                    {([0, 5, 10] as const).map((amt) => (
                      <button key={amt} type="button" onClick={() => setParcelCharge(amt)}
                        className={`flex-1 py-2 text-sm font-medium transition-colors ${parcelCharge === amt ? "bg-orange-500 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
                        {amt === 0 ? "None" : `+₹${amt}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Payment</label>
                <div className="flex rounded-lg border border-slate-300 overflow-hidden">
                  {(["CASH", "UPI"] as const).map((m) => (
                    <button key={m} type="button" onClick={() => setPaymentMethod(m)}
                      className={`flex-1 py-2 text-sm font-medium transition-colors ${paymentMethod === m ? (m === "CASH" ? "bg-green-500 text-white" : "bg-indigo-500 text-white") : "bg-white text-slate-600 hover:bg-slate-50"}`}>
                      {m === "CASH" ? "💵 Cash" : "📲 UPI"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Notes</label>
                <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder="Special instructions…" autoComplete="off"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
            </div>
          </div>

          {/* Item search */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
            <div className="relative mb-3">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">🔍</span>
              <input
                ref={searchRef}
                type="search" value={search}
                onChange={(e) => { setSearch(e.target.value); setSuggestionIdx(-1); }}
                onKeyDown={(e) => handleSuggestionKey(e, suggestions.length, suggestionIdx, setSuggestionIdx,
                  (idx) => acceptSuggestion(suggestions[idx]),
                  () => { setSearch(""); setSuggestionIdx(-1); }
                )}
                placeholder="Search items or category…" autoComplete="off"
                style={{ colorScheme: "light" }}
                className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <SuggestionDropdown suggestions={suggestions} activeIdx={suggestionIdx} onSelect={acceptSuggestion} />
            </div>

            {Object.entries(grouped).map(([cat, items]) => (
              <div key={cat} className="mb-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">{cat}</p>
                <div className="space-y-1">
                  {items.map((item) => {
                    const qty = getQty(item.id);
                    const isWeight = item.unit === "100g";
                    const cartRow = cart.find((r) => r.item.id === item.id);
                    const gramVal = gramInputs[item.id] ?? "";
                    const gramNum = parseFloat(gramVal);
                    const previewPrice = gramNum > 0 ? Math.ceil((gramNum / 1000) * (item.price * 10)) : 0;

                    if (isWeight) return (
                      <div key={item.id} className={`rounded-xl border px-3 py-2.5 ${cartRow ? "bg-amber-50 border-amber-300" : "bg-white border-slate-100"}`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div>
                            <p className="text-sm font-medium text-slate-800">{item.name}</p>
                            <p className="text-xs text-slate-500">₹{item.price * 10}/kg</p>
                          </div>
                          {cartRow && (
                            <div className="text-right">
                              <p className="text-xs font-bold text-amber-600">⚖️ {cartRow.customGrams}g = ₹{cartRow.customPrice}</p>
                              <button type="button" onClick={() => setCart((p) => p.filter((r) => r.item.id !== item.id))}
                                className="text-xs text-red-400 hover:text-red-600">Remove</button>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="number" min="10" max="10000" value={gramVal}
                            onChange={(e) => setGramInputs((p) => ({ ...p, [item.id]: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addWeightItem(item); } }}
                            placeholder="Enter grams e.g. 210"
                            className="flex-1 border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-slate-400" />
                          <button type="button" onClick={() => addWeightItem(item)} disabled={!gramNum || gramNum <= 0}
                            className="bg-amber-500 hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                            {gramNum > 0 ? `Add ${gramVal}g = ₹${previewPrice}` : "⚖️ Add"}
                          </button>
                        </div>
                      </div>
                    );

                    return (
                      <div key={item.id} className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-colors ${qty > 0 ? "bg-amber-50 border-amber-300" : "bg-white border-slate-100 hover:border-slate-200"}`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
                          <p className="text-xs text-slate-500">₹{item.price}</p>
                        </div>
                        {qty === 0 ? (
                          <button type="button" onClick={() => setQty(item, 1)}
                            className="w-8 h-8 bg-amber-500 hover:bg-amber-600 text-white rounded-full flex items-center justify-center font-bold text-lg leading-none flex-shrink-0">+</button>
                        ) : (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button type="button" onClick={() => setQty(item, qty - 1)}
                              className="w-7 h-7 bg-slate-200 hover:bg-slate-300 rounded-full flex items-center justify-center font-bold text-slate-700 leading-none">−</button>
                            <span className="w-5 text-center font-bold text-slate-800 text-sm">{qty}</span>
                            <button type="button" onClick={() => setQty(item, qty + 1)}
                              className="w-7 h-7 bg-amber-500 hover:bg-amber-600 text-white rounded-full flex items-center justify-center font-bold leading-none">+</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </form>
      </div>

      {/* Sticky footer */}
      <div className="fixed bottom-0 bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] px-4 py-3 space-y-2 w-full max-w-2xl" style={{ left: "50%", transform: "translateX(-50%)" }}>
        {error && <p className="text-sm text-red-600 font-medium bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

        {cart.length > 0 && (
          <div className="bg-slate-50 rounded-xl px-3 py-2 max-h-28 overflow-y-auto space-y-1">
            {cart.map((r) => (
              <div key={r.item.id} className="flex items-center justify-between text-sm gap-2">
                <span className="text-slate-700 truncate flex-1">{r.item.name} {r.customGrams ? `⚖️ ${r.customGrams}g` : `× ${r.qty}`}</span>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {!r.customGrams && (
                    <>
                      <button type="button" onClick={() => setQty(r.item, r.qty - 1)}
                        className="w-5 h-5 bg-slate-200 hover:bg-slate-300 rounded-full flex items-center justify-center text-xs font-bold leading-none">−</button>
                      <span className="w-4 text-center text-xs font-bold text-slate-700">{r.qty}</span>
                      <button type="button" onClick={() => setQty(r.item, r.qty + 1)}
                        className="w-5 h-5 bg-amber-400 hover:bg-amber-500 text-white rounded-full flex items-center justify-center text-xs font-bold leading-none">+</button>
                    </>
                  )}
                  <span className="text-slate-500 font-medium w-12 text-right">₹{(r.customPrice ?? r.item.price * r.qty).toFixed(0)}</span>
                </div>
              </div>
            ))}
            {discountAmt > 0 && (
              <div className="flex justify-between text-xs text-green-600 font-semibold pt-1 border-t border-slate-200">
                <span>Discount</span><span>-₹{discountAmt.toFixed(0)}</span>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 flex-1">
            <input type="number" min="0" value={discountInput} onChange={(e) => setDiscountInput(e.target.value)}
              placeholder="Discount ₹0"
              className="w-28 border border-green-300 rounded-lg px-2 py-1.5 text-sm font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-green-400 placeholder-slate-400" />
            {[10, 20, 50].map((pct) => (
              <button key={pct} type="button" onClick={() => setDiscountInput(String(Math.round(subtotal * pct / 100)))}
                disabled={cart.length === 0}
                className="text-xs px-2 py-1.5 rounded-lg border border-green-300 text-green-700 hover:bg-green-50 disabled:opacity-40 font-semibold">
                {pct}%
              </button>
            ))}
          </div>
        </div>

        <button type="submit" form="new-order-form" disabled={submitting || cart.length === 0}
          className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-bold py-3.5 rounded-xl transition-colors text-base">
          {submitting ? "Placing…" : cart.length === 0 ? "Add items to continue" : `Place Order · ${cart.length} item${cart.length !== 1 ? "s" : ""} · ₹${total.toFixed(0)}`}
        </button>
      </div>
    </div>
  );
}

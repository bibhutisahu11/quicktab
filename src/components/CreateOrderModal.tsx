"use client";

import { useState, useEffect, useMemo } from "react";
import { MenuItemData } from "@/types";

interface Table { id: string; name: string; }

interface CartRow { item: MenuItemData; qty: number; }

interface Props {
  orgSlug: string;
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateOrderModal({ orgSlug, onClose, onCreated }: Props) {
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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/menu")
      .then((r) => r.ok ? r.json() : [])
      .then((data: MenuItemData[]) => setMenuItems(data.filter((m) => m.available)))
      .catch(() => {});
    fetch(`/api/admin/tables`)
      .then((r) => r.ok ? r.json() : { tables: [] })
      .then((data: { tables: { id: string; name: string }[] }) => {
        const list = data.tables ?? [];
        setTables(list);
        if (list.length > 0) setTableId(list[0].id);
      })
      .catch(() => {});
  }, []);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return menuItems;
    return menuItems.filter((m) =>
      m.name.toLowerCase().includes(q) || m.category.toLowerCase().includes(q)
    );
  }, [menuItems, search]);

  // Group filtered items by category
  const grouped = useMemo(() => {
    const map: Record<string, MenuItemData[]> = {};
    filteredItems.forEach((m) => {
      (map[m.category] ??= []).push(m);
    });
    return map;
  }, [filteredItems]);

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

  function getQty(itemId: string) {
    return cart.find((r) => r.item.id === itemId)?.qty ?? 0;
  }

  const subtotal = cart.reduce((s, r) => s + r.item.price * r.qty, 0);
  const total = subtotal + (orderType === "PARCEL" ? parcelCharge : 0);
  const itemCount = cart.reduce((s, r) => s + r.qty, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerName.trim()) { setError("Customer name is required"); return; }
    if (cart.length === 0) { setError("Add at least one item"); return; }
    if (orderType === "TABLE" && !tableId) { setError("Select a table"); return; }

    setError("");
    setSubmitting(true);
    try {
      const body = {
        type: orderType,
        ...(orderType === "TABLE" ? { tableId } : { orgSlug }),
        customerName: customerName.trim(),
        phone: phone.trim() || undefined,
        notes: notes.trim() || undefined,
        paymentMethod,
        parcelCharge: orderType === "PARCEL" ? parcelCharge : 0,
        adminCreated: true,
        items: cart.map((r) => ({ menuItemId: r.item.id, quantity: r.qty })),
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error ?? "Failed to create order");
        return;
      }

      onCreated();
      onClose();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col my-auto" style={{ maxHeight: "calc(100vh - 2rem)", minHeight: 0 }}>
        {/* Header */}
        <div className="bg-amber-500 text-white px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold">➕ New Order</h2>
            <p className="text-amber-100 text-xs mt-0.5">Creating order at counter</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-amber-400/50 hover:bg-amber-400 rounded-full flex items-center justify-center text-white font-bold transition-colors">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          <form id="create-order-form" onSubmit={handleSubmit}>
            {/* Customer + Type */}
            <div className="px-6 py-4 border-b border-slate-100 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Customer Name *</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Walk-in Customer"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Optional"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Order type */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Order Type</label>
                  <div className="flex rounded-lg border border-slate-300 overflow-hidden">
                    <button type="button" onClick={() => setOrderType("TABLE")}
                      className={`flex-1 py-2 text-sm font-medium transition-colors ${orderType === "TABLE" ? "bg-amber-500 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
                      🍽️ Dine-in
                    </button>
                    <button type="button" onClick={() => setOrderType("PARCEL")}
                      className={`flex-1 py-2 text-sm font-medium transition-colors ${orderType === "PARCEL" ? "bg-amber-500 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
                      📦 Parcel
                    </button>
                  </div>
                </div>
                {/* Table selector */}
                {orderType === "TABLE" ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Table</label>
                    <select
                      value={tableId}
                      onChange={(e) => setTableId(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    >
                      {tables.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Payment</label>
                    <div className="flex rounded-lg border border-slate-300 overflow-hidden">
                      <button type="button" onClick={() => setPaymentMethod("CASH")}
                        className={`flex-1 py-2 text-sm font-medium transition-colors ${paymentMethod === "CASH" ? "bg-green-500 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
                        💵 Cash
                      </button>
                      <button type="button" onClick={() => setPaymentMethod("UPI")}
                        className={`flex-1 py-2 text-sm font-medium transition-colors ${paymentMethod === "UPI" ? "bg-indigo-500 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
                        📲 UPI
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {orderType === "TABLE" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Payment</label>
                  <div className="flex rounded-lg border border-slate-300 overflow-hidden w-48">
                    <button type="button" onClick={() => setPaymentMethod("CASH")}
                      className={`flex-1 py-2 text-sm font-medium transition-colors ${paymentMethod === "CASH" ? "bg-green-500 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
                      💵 Cash
                    </button>
                    <button type="button" onClick={() => setPaymentMethod("UPI")}
                      className={`flex-1 py-2 text-sm font-medium transition-colors ${paymentMethod === "UPI" ? "bg-indigo-500 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
                      📲 UPI
                    </button>
                  </div>
                </div>
              )}

              {/* Parcel charge — only for parcel orders */}
              {orderType === "PARCEL" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Parcel Charge</label>
                  <div className="flex rounded-lg border border-slate-300 overflow-hidden">
                    {([0, 5, 10] as const).map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setParcelCharge(amt)}
                        className={`flex-1 py-2 text-sm font-medium transition-colors ${
                          parcelCharge === amt
                            ? "bg-orange-500 text-white"
                            : "bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {amt === 0 ? "None" : `+₹${amt}`}
                      </button>
                    ))}
                  </div>
                  {parcelCharge > 0 && (
                    <p className="text-xs text-orange-600 mt-1">₹{parcelCharge} parcel charge will be added to total</p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Special instructions…"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>

            {/* Item search + list */}
            <div className="px-6 py-4">
              <div className="relative mb-3">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search items…"
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              {Object.entries(grouped).map(([cat, items]) => (
                <div key={cat} className="mb-4">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">{cat}</p>
                  <div className="space-y-1">
                    {items.map((item) => {
                      const qty = getQty(item.id);
                      return (
                        <div key={item.id} className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-colors ${qty > 0 ? "bg-amber-50 border-amber-300" : "bg-white border-slate-100 hover:border-slate-200"}`}>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
                            <p className="text-xs text-slate-500">₹{item.price}</p>
                          </div>
                          {qty === 0 ? (
                            <button
                              type="button"
                              onClick={() => setQty(item, 1)}
                              className="w-8 h-8 bg-amber-500 hover:bg-amber-600 text-white rounded-full flex items-center justify-center font-bold text-lg leading-none transition-colors flex-shrink-0"
                            >
                              +
                            </button>
                          ) : (
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button type="button" onClick={() => setQty(item, qty - 1)}
                                className="w-7 h-7 bg-slate-200 hover:bg-slate-300 rounded-full flex items-center justify-center font-bold text-slate-700 leading-none transition-colors">
                                −
                              </button>
                              <span className="w-5 text-center font-bold text-slate-800 text-sm">{qty}</span>
                              <button type="button" onClick={() => setQty(item, qty + 1)}
                                className="w-7 h-7 bg-amber-500 hover:bg-amber-600 text-white rounded-full flex items-center justify-center font-bold leading-none transition-colors">
                                +
                              </button>
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

        {/* Sticky footer — cart summary + submit */}
        <div className="flex-shrink-0 border-t border-slate-200 bg-white px-6 py-4 space-y-3">
          {error && (
            <p className="text-sm text-red-600 font-medium bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          {cart.length > 0 && (
            <div className="bg-slate-50 rounded-xl px-4 py-3 space-y-1 max-h-32 overflow-y-auto">
              {cart.map((r) => (
                <div key={r.item.id} className="flex justify-between text-sm">
                  <span className="text-slate-700">{r.item.name} × {r.qty}</span>
                  <span className="text-slate-500 font-medium">₹{(r.item.price * r.qty).toFixed(0)}</span>
                </div>
              ))}
              {orderType === "PARCEL" && parcelCharge > 0 && (
                <>
                  <div className="flex justify-between text-sm text-orange-600 pt-1 border-t border-slate-200">
                    <span>Parcel charge</span>
                    <span className="font-medium">₹{parcelCharge}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-slate-800 pt-1 border-t border-slate-200">
                    <span>Total</span>
                    <span>₹{total.toFixed(0)}</span>
                  </div>
                </>
              )}
            </div>
          )}

          <button
            type="submit"
            form="create-order-form"
            disabled={submitting || cart.length === 0}
            className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? "Placing…" : cart.length === 0 ? "Add items to continue" : `Place Order · ${itemCount} item${itemCount !== 1 ? "s" : ""} · ₹${total.toFixed(0)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

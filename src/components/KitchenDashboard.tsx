"use client";

import { useEffect, useRef, useState } from "react";
import { MenuItemData, OrderData, OrderStatus, OrgSettings } from "@/types";
import { estimateWaitMins, formatWait, getOrderUrgency, overdueByMins } from "@/lib/waitingTime";
import { playNewOrderSound } from "@/lib/notificationSound";
import { exportOrdersToCsv } from "@/lib/exportCsv";
import { printOrder, printAllOrders } from "@/lib/printOrder";

const STATUS_LABELS: Record<OrderStatus, string> = {
  PAYMENT_PENDING: "Awaiting Payment",
  PENDING: "New Orders",
  PREPARING: "Preparing",
  READY: "Ready to Serve",
  DONE: "Completed",
  CANCELLED: "Cancelled",
};

const STATUS_COLORS: Record<OrderStatus, { bg: string; border: string; badge: string }> = {
  PAYMENT_PENDING: { bg: "bg-purple-50", border: "border-purple-200", badge: "bg-purple-100 text-purple-700" },
  PENDING: { bg: "bg-amber-50", border: "border-amber-200", badge: "bg-amber-100 text-amber-700" },
  PREPARING: { bg: "bg-blue-50", border: "border-blue-200", badge: "bg-blue-100 text-blue-700" },
  READY: { bg: "bg-green-50", border: "border-green-200", badge: "bg-green-100 text-green-700" },
  DONE: { bg: "bg-slate-50", border: "border-slate-200", badge: "bg-slate-100 text-slate-600" },
  CANCELLED: { bg: "bg-red-50", border: "border-red-200", badge: "bg-red-100 text-red-600" },
};

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  PENDING: "PREPARING",
  PREPARING: "READY",
  READY: "DONE",
};

const NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  PENDING: "Start Preparing",
  PREPARING: "Mark Ready",
  READY: "Mark Done",
};

const ACTIVE_STATUSES: OrderStatus[] = ["PENDING", "PREPARING", "READY"];

export default function KitchenDashboard() {
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [filter, setFilter] = useState<OrderStatus | "ALL">("ALL");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [newOrderFlash, setNewOrderFlash] = useState(false);
  const [exportDate, setExportDate] = useState(new Date().toISOString().slice(0, 10));
  const [orgSettings, setOrgSettings] = useState<OrgSettings | null>(null);
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>({});
  const [tick, setTick] = useState(0);
  const [todayBirthdays, setTodayBirthdays] = useState<{ name: string; phone: string }[]>([]);
  const [lowStock, setLowStock] = useState<{ name: string; quantity: number; unit: string; status: "out" | "low" }[]>([]);
  const knownOrderIds = useRef<Set<string>>(new Set());
  const isFirstLoad = useRef(true);

  useEffect(() => {
    fetch("/api/admin/org-settings")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => data && setOrgSettings(data))
      .catch(() => {});
    fetch("/api/menu")
      .then((r) => r.ok ? r.json() : [])
      .then((items: MenuItemData[]) => {
        const map: Record<string, string> = {};
        items.forEach((m) => { map[m.id] = m.category; });
        setCategoryMap(map);
      })
      .catch(() => {});
    // Check today's birthdays
    fetch("/api/admin/customers")
      .then((r) => r.ok ? r.json() : { customers: [] })
      .then(({ customers }: { customers: { name: string; phone: string; birthday?: string }[] }) => {
        const today = new Date();
        const todayMM = today.getMonth();
        const todayDD = today.getDate();
        const bdays = customers.filter((c) => {
          if (!c.birthday) return false;
          const b = new Date(c.birthday);
          return b.getMonth() === todayMM && b.getDate() === todayDD;
        }).map((c) => ({ name: c.name, phone: c.phone }));
        setTodayBirthdays(bdays);
      })
      .catch(() => {});
    // Fetch inventory for low-stock alerts
    fetch("/api/admin/inventory")
      .then((r) => r.ok ? r.json() : [])
      .then((inv: { name: string; quantity: number; unit: string; minStock: number }[]) => {
        const alerts = inv
          .filter((i) => i.quantity <= 0 || (i.minStock > 0 && i.quantity <= i.minStock))
          .map((i) => ({
            name: i.name, quantity: i.quantity, unit: i.unit,
            status: (i.quantity <= 0 ? "out" : "low") as "out" | "low",
          }));
        setLowStock(alerts);
      })
      .catch(() => {});
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  async function fetchOrders() {
    try {
      const res = await fetch("/api/orders");
      if (res.ok) {
        const data: OrderData[] = await res.json();

        // Detect brand-new PENDING orders on subsequent polls
        if (!isFirstLoad.current) {
          const newOrders = data.filter(
            (o) => o.status === "PENDING" && !knownOrderIds.current.has(o.id)
          );
          if (newOrders.length > 0) {
            if (soundEnabled) playNewOrderSound();
            setNewOrderFlash(true);
            setTimeout(() => setNewOrderFlash(false), 2000);
          }
        }

        // Update known IDs
        data.forEach((o) => knownOrderIds.current.add(o.id));
        isFirstLoad.current = false;
        setOrders(data);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 15000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soundEnabled]);

  async function updateStatus(orderId: string, status: OrderStatus) {
    setUpdatingId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const updated = await res.json();
        setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      }
    } finally {
      setUpdatingId(null);
    }
  }

  const filteredOrders = orders.filter((o) => {
    if (filter === "ALL") return ACTIVE_STATUSES.includes(o.status);
    return o.status === filter;
  });

  const counts = orders.reduce(
    (acc, o) => {
      acc[o.status] = (acc[o.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center">
          <div className="text-5xl animate-pulse mb-4">🍳</div>
          <p className="text-slate-500">Loading orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            Kitchen Dashboard
            {newOrderFlash && (
              <span className="animate-bounce bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                🔔 New Order!
              </span>
            )}
          </h1>
          <p className="text-slate-500 text-sm">Auto-refreshes every 15 seconds</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSoundEnabled((s) => !s)}
            title={soundEnabled ? "Mute order alerts" : "Unmute order alerts"}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              soundEnabled
                ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                : "bg-slate-100 text-slate-400 hover:bg-slate-200"
            }`}
          >
            {soundEnabled ? "🔔 Sound On" : "🔕 Sound Off"}
          </button>
          <button
            onClick={() => {
              const today = new Date().toISOString().slice(0, 10);
              const todayOrders = orders.filter(
                (o) => new Date(o.createdAt).toISOString().slice(0, 10) === today
              );
              printAllOrders(todayOrders, orgSettings);
            }}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-4 py-2 rounded-lg text-sm transition-colors"
          >
            🖨️ Print Day
          </button>
          <button
            onClick={fetchOrders}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-4 py-2 rounded-lg text-sm transition-colors"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* EZO Export Panel */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-blue-800 text-sm">Export to EZO Books</p>
          <p className="text-blue-600 text-xs mt-0.5">Download orders as CSV — import directly into EZO Books</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={exportDate}
            onChange={(e) => setExportDate(e.target.value)}
            className="border border-blue-300 rounded-lg px-3 py-1.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            onClick={() => {
              const filtered = orders.filter((o) => {
                const d = new Date(o.createdAt).toISOString().slice(0, 10);
                return d === exportDate;
              });
              if (filtered.length === 0) {
                alert(`No orders found for ${exportDate}`);
                return;
              }
              exportOrdersToCsv(filtered);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors whitespace-nowrap"
          >
            📥 Export CSV
          </button>
          <button
            onClick={() => exportOrdersToCsv(orders)}
            className="bg-slate-600 hover:bg-slate-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
            title="Export all orders"
          >
            All
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {ACTIVE_STATUSES.map((s) => (
          <div key={s} className={`rounded-xl p-4 border ${STATUS_COLORS[s].bg} ${STATUS_COLORS[s].border}`}>
            <div className="text-3xl font-bold text-slate-800">{counts[s] ?? 0}</div>
            <div className="text-sm font-medium text-slate-600 mt-0.5">{STATUS_LABELS[s]}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {(["ALL", ...ACTIVE_STATUSES, "DONE", "CANCELLED"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === s
                ? "bg-slate-800 text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {s === "ALL" ? "Active Orders" : STATUS_LABELS[s]}
            {s !== "ALL" && counts[s] ? (
              <span className="ml-1.5 bg-white/20 rounded-full px-1.5 py-0.5 text-xs">
                {counts[s]}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* ── Low stock alert ──────────────────────────────────────────────── */}
      {lowStock.length > 0 && (
        <div className={`mb-4 rounded-xl px-5 py-3 flex items-center gap-3 flex-wrap ${lowStock.some((i) => i.status === "out") ? "bg-red-50 border border-red-200" : "bg-amber-50 border border-amber-200"}`}>
          <span className="text-xl">{lowStock.some((i) => i.status === "out") ? "🚨" : "⚠️"}</span>
          <div className="flex-1">
            <p className={`font-bold text-sm ${lowStock.some((i) => i.status === "out") ? "text-red-700" : "text-amber-700"}`}>
              Inventory Alert
            </p>
            <p className="text-xs text-slate-600 mt-0.5">
              {lowStock.map((i) => `${i.name} (${i.quantity <= 0 ? "OUT" : `${i.quantity} ${i.unit}`})`).join(" · ")}
            </p>
          </div>
          <a href="/admin/inventory" className={`text-xs font-bold px-4 py-1.5 rounded-lg text-white transition-colors ${lowStock.some((i) => i.status === "out") ? "bg-red-600 hover:bg-red-700" : "bg-amber-500 hover:bg-amber-600"}`}>
            Manage →
          </a>
        </div>
      )}

      {/* ── Today's birthdays banner ──────────────────────────────────────── */}
      {todayBirthdays.length > 0 && (
        <div className="mb-4 bg-gradient-to-r from-pink-50 to-rose-50 border border-pink-300 rounded-xl px-5 py-3 flex items-center gap-3 flex-wrap">
          <span className="text-2xl">🎂</span>
          <div className="flex-1">
            <p className="font-bold text-rose-700 text-sm">Birthday Today!</p>
            <p className="text-rose-600 text-xs">
              {todayBirthdays.map((b) => b.name).join(", ")}
            </p>
          </div>
          {todayBirthdays.map((b) =>
            b.phone ? (
              <a key={b.phone} href={`tel:${b.phone}`}
                className="bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold px-4 py-1.5 rounded-lg transition-colors">
                Call {b.name.split(" ")[0]} 🎁
              </a>
            ) : null
          )}
          <a href="/admin/customers"
            className="text-rose-500 hover:text-rose-700 text-xs font-medium underline">
            View all birthdays →
          </a>
        </div>
      )}

      {/* ── Attention section ── overdue + near-ETA active orders ────────── */}
      {(() => {
        const activeOrders = orders.filter(
          (o) => o.status === "PENDING" || o.status === "PREPARING"
        );
        const overdue = activeOrders.filter(
          (o) => getOrderUrgency(o, activeOrders, categoryMap) === "overdue"
        );
        const near = activeOrders.filter(
          (o) => getOrderUrgency(o, activeOrders, categoryMap) === "near"
        );
        if (overdue.length === 0 && near.length === 0) return null;

        return (
          <div className="mb-6 space-y-3">
            {overdue.length > 0 && (
              <div className="bg-red-50 border border-red-300 rounded-xl p-4">
                <h2 className="text-red-700 font-bold text-sm mb-3 flex items-center gap-2">
                  🚨 Overdue — Action Required
                  <span className="bg-red-600 text-white text-xs rounded-full px-2 py-0.5">
                    {overdue.length}
                  </span>
                </h2>
                <div className="flex flex-col gap-2">
                  {overdue.map((o) => {
                    const late = overdueByMins(o, activeOrders, categoryMap);
                    return (
                      <div
                        key={o.id}
                        className="bg-white border border-red-200 rounded-lg px-4 py-3 flex items-center justify-between"
                      >
                        <div>
                          <span className="font-bold text-slate-800 text-sm">
                            #{o.id.slice(-6).toUpperCase()}
                          </span>
                          <span className="text-slate-500 text-xs ml-2">{o.customerName}</span>
                          <span className="text-slate-400 text-xs ml-2">
                            {o.type === "TABLE" ? `🍽️ ${o.table?.name ?? "Table"}` : "📦 Parcel"}
                          </span>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {o.items.map((i) => `${i.name} ×${i.quantity}`).join(", ")}
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-4">
                          <p className="text-red-600 font-extrabold text-sm">
                            {late > 0 ? `+${late}m late` : "Due now"}
                          </p>
                          {NEXT_STATUS[o.status] && (
                            <button
                              onClick={() => updateStatus(o.id, NEXT_STATUS[o.status]!)}
                              disabled={updatingId === o.id}
                              className="mt-1 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-xs font-bold px-3 py-1 rounded-lg transition-colors"
                            >
                              {updatingId === o.id ? "…" : NEXT_LABEL[o.status]}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {near.length > 0 && (
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-4">
                <h2 className="text-amber-700 font-bold text-sm mb-3 flex items-center gap-2">
                  ⚠️ Almost Due — Speed Up
                  <span className="bg-amber-500 text-white text-xs rounded-full px-2 py-0.5">
                    {near.length}
                  </span>
                </h2>
                <div className="flex flex-col gap-2">
                  {near.map((o) => {
                    const remaining = estimateWaitMins(o, activeOrders, categoryMap);
                    return (
                      <div
                        key={o.id}
                        className="bg-white border border-amber-200 rounded-lg px-4 py-3 flex items-center justify-between"
                      >
                        <div>
                          <span className="font-bold text-slate-800 text-sm">
                            #{o.id.slice(-6).toUpperCase()}
                          </span>
                          <span className="text-slate-500 text-xs ml-2">{o.customerName}</span>
                          <span className="text-slate-400 text-xs ml-2">
                            {o.type === "TABLE" ? `🍽️ ${o.table?.name ?? "Table"}` : "📦 Parcel"}
                          </span>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {o.items.map((i) => `${i.name} ×${i.quantity}`).join(", ")}
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-4">
                          <p className="text-amber-600 font-bold text-sm">⏱ {formatWait(remaining)}</p>
                          {NEXT_STATUS[o.status] && (
                            <button
                              onClick={() => updateStatus(o.id, NEXT_STATUS[o.status]!)}
                              disabled={updatingId === o.id}
                              className="mt-1 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white text-xs font-bold px-3 py-1 rounded-lg transition-colors"
                            >
                              {updatingId === o.id ? "…" : NEXT_LABEL[o.status]}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Order cards */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <div className="text-5xl mb-3">🍽️</div>
          <p className="text-lg">No orders here</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredOrders.map((order) => {
            const colors = STATUS_COLORS[order.status];
            const nextStatus = NEXT_STATUS[order.status];
            const nextLabel = NEXT_LABEL[order.status];
            const isUpdating = updatingId === order.id;
            // ETA — only meaningful for PENDING/PREPARING; tick forces recalc every 30s
            const waitMins = (order.status === "PENDING" || order.status === "PREPARING")
              ? estimateWaitMins(order, orders, categoryMap) + (tick * 0)
              : 0;

            return (
              <div
                key={order.id}
                className={`rounded-xl border p-4 shadow-sm ${colors.bg} ${colors.border} flex flex-col gap-3`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-800">
                      #{order.id.slice(-6).toUpperCase()}
                    </p>
                    <p className="text-slate-600 text-sm">{order.customerName}</p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-xs font-bold px-2 py-1 rounded-full ${colors.badge}`}
                    >
                      {order.type === "TABLE"
                        ? `🍽️ ${order.table?.name ?? "Table"}`
                        : "📦 Parcel"}
                    </span>
                    {waitMins > 0 && (
                      <p className="text-xs font-semibold text-orange-600 mt-1">
                        ⏱ {formatWait(waitMins)}
                      </p>
                    )}
                    <p className="text-xs text-slate-400 mt-0.5">
                      {new Date(order.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>

                <div className="space-y-1">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <div>
                        <span className="text-slate-700">{item.name} × {item.quantity}</span>
                        {item.notes && (
                          <p className="text-xs font-bold text-amber-600 mt-0.5">🌶 {item.notes}</p>
                        )}
                      </div>
                      <span className="text-slate-500">₹{item.price.toFixed(0)}</span>
                    </div>
                  ))}
                </div>

                {order.notes && (
                  <div className="bg-white/60 rounded-lg px-3 py-2 text-sm text-slate-600 italic">
                    "{order.notes}"
                  </div>
                )}

                <div className="flex items-center justify-between pt-1 border-t border-current/10">
                  <span className="font-bold text-slate-800">₹{order.total.toFixed(0)}</span>
                  <div className="flex gap-2 items-center">
                    <button
                      onClick={() => printOrder(order, orgSettings)}
                      title="Print receipt"
                      className="text-slate-400 hover:text-slate-700 transition-colors p-1 text-base"
                    >
                      🖨️
                    </button>
                    {order.status !== "DONE" && order.status !== "CANCELLED" && (
                      <button
                        onClick={() => updateStatus(order.id, "CANCELLED")}
                        disabled={isUpdating}
                        className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    )}
                    {nextStatus && (
                      <button
                        onClick={() => updateStatus(order.id, nextStatus)}
                        disabled={isUpdating}
                        className="bg-slate-800 hover:bg-slate-700 disabled:bg-slate-400 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
                      >
                        {isUpdating ? "..." : nextLabel}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

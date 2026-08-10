"use client";

import { useEffect, useRef, useState } from "react";
import { MenuItemData, OrderData, OrderStatus } from "@/types";
import { playNewOrderSound } from "@/lib/notificationSound";
import { estimateWaitMins, formatWait, getOrderUrgency, overdueByMins } from "@/lib/waitingTime";

const STATUS_COLORS: Record<string, { bg: string; border: string; badge: string }> = {
  PENDING: { bg: "bg-amber-50", border: "border-amber-200", badge: "bg-amber-100 text-amber-700" },
  PREPARING: { bg: "bg-blue-50", border: "border-blue-200", badge: "bg-blue-100 text-blue-700" },
  READY: { bg: "bg-green-50", border: "border-green-200", badge: "bg-green-100 text-green-700" },
  DONE: { bg: "bg-slate-50", border: "border-slate-200", badge: "bg-slate-100 text-slate-600" },
  CANCELLED: { bg: "bg-red-50", border: "border-red-200", badge: "bg-red-100 text-red-600" },
};

export default function KitchenView() {
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [newOrderFlash, setNewOrderFlash] = useState(false);
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>({});
  const [tick, setTick] = useState(0);
  const knownOrderIds = useRef<Set<string>>(new Set());
  const isFirstLoad = useRef(true);

  async function fetchOrders() {
    try {
      const res = await fetch("/api/orders?status=PENDING&status=PREPARING");
      if (res.ok) {
        // Fetch all orders; filter to active kitchen statuses
        const res2 = await fetch("/api/orders");
        if (res2.ok) {
          const data: OrderData[] = await res2.json();
          const active = data.filter((o) => ["PENDING", "PREPARING"].includes(o.status));

          if (!isFirstLoad.current) {
            const newOrders = active.filter(
              (o) => o.status === "PENDING" && !knownOrderIds.current.has(o.id)
            );
            if (newOrders.length > 0) {
              if (soundEnabled) playNewOrderSound();
              setNewOrderFlash(true);
              setTimeout(() => setNewOrderFlash(false), 2000);
            }
          }
          active.forEach((o) => knownOrderIds.current.add(o.id));
          isFirstLoad.current = false;
          setOrders(active);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetch("/api/menu")
      .then((r) => r.ok ? r.json() : [])
      .then((items: MenuItemData[]) => {
        const map: Record<string, string> = {};
        items.forEach((m) => { map[m.id] = m.category; });
        setCategoryMap(map);
      })
      .catch(() => {});
    const tickInterval = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(tickInterval);
  }, []);

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
        setOrders((prev) => prev.filter((o) => !(o.id === orderId && status === "READY")));
        const updated = await res.json();
        if (status !== "READY") {
          setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
        }
      }
    } finally {
      setUpdatingId(null);
    }
  }

  const pending = orders.filter((o) => o.status === "PENDING");
  const preparing = orders.filter((o) => o.status === "PREPARING");

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
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            Kitchen View
            {newOrderFlash && (
              <span className="animate-bounce bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                New Order!
              </span>
            )}
          </h1>
          <p className="text-slate-500 text-sm">Auto-refreshes every 15 seconds</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSoundEnabled((s) => !s)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              soundEnabled
                ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                : "bg-slate-100 text-slate-400"
            }`}
          >
            {soundEnabled ? "Sound On" : "Sound Off"}
          </button>
          <button onClick={fetchOrders} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-4 py-2 rounded-lg text-sm transition-colors">
            Refresh
          </button>
        </div>
      </div>

      {/* ── Attention alerts ────────────────────────────────────────────────── */}
      {(() => {
        const overdue = orders.filter((o) => getOrderUrgency(o, orders, categoryMap) === "overdue");
        const near    = orders.filter((o) => getOrderUrgency(o, orders, categoryMap) === "near");
        if (overdue.length === 0 && near.length === 0) return null;
        void tick; // trigger re-render every 30 s
        return (
          <div className="mb-6 space-y-3">
            {overdue.length > 0 && (
              <div className="bg-red-50 border border-red-300 rounded-xl p-4">
                <h2 className="text-red-700 font-bold text-sm mb-3 flex items-center gap-2">
                  🚨 Overdue — Action Required
                  <span className="bg-red-600 text-white text-xs rounded-full px-2 py-0.5">{overdue.length}</span>
                </h2>
                <div className="flex flex-col gap-2">
                  {overdue.map((o) => {
                    const late = overdueByMins(o, orders, categoryMap);
                    return (
                      <div key={o.id} className="bg-white border border-red-200 rounded-lg px-4 py-3 flex items-center justify-between">
                        <div>
                          <span className="font-bold text-slate-800 text-sm">#{o.id.slice(-6).toUpperCase()}</span>
                          <span className="text-slate-500 text-xs ml-2">{o.customerName}</span>
                          <span className="text-slate-400 text-xs ml-2">{o.type === "TABLE" ? `🍽️ ${o.table?.name ?? "Table"}` : "📦 Parcel"}</span>
                          <div className="text-xs text-slate-500 mt-0.5">{o.items.map((i) => `${i.name} ×${i.quantity}`).join(", ")}</div>
                        </div>
                        <div className="text-right shrink-0 ml-4">
                          <p className="text-red-600 font-extrabold text-sm">{late > 0 ? `+${late}m late` : "Due now"}</p>
                          <button onClick={() => updateStatus(o.id, o.status === "PENDING" ? "PREPARING" : "READY")}
                            disabled={updatingId === o.id}
                            className="mt-1 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-xs font-bold px-3 py-1 rounded-lg">
                            {updatingId === o.id ? "…" : o.status === "PENDING" ? "Start Cooking" : "Mark Ready"}
                          </button>
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
                  <span className="bg-amber-500 text-white text-xs rounded-full px-2 py-0.5">{near.length}</span>
                </h2>
                <div className="flex flex-col gap-2">
                  {near.map((o) => {
                    const rem = estimateWaitMins(o, orders, categoryMap);
                    return (
                      <div key={o.id} className="bg-white border border-amber-200 rounded-lg px-4 py-3 flex items-center justify-between">
                        <div>
                          <span className="font-bold text-slate-800 text-sm">#{o.id.slice(-6).toUpperCase()}</span>
                          <span className="text-slate-500 text-xs ml-2">{o.customerName}</span>
                          <span className="text-slate-400 text-xs ml-2">{o.type === "TABLE" ? `🍽️ ${o.table?.name ?? "Table"}` : "📦 Parcel"}</span>
                          <div className="text-xs text-slate-500 mt-0.5">{o.items.map((i) => `${i.name} ×${i.quantity}`).join(", ")}</div>
                        </div>
                        <div className="text-right shrink-0 ml-4">
                          <p className="text-amber-600 font-bold text-sm">⏱ {formatWait(rem)}</p>
                          <button onClick={() => updateStatus(o.id, o.status === "PENDING" ? "PREPARING" : "READY")}
                            disabled={updatingId === o.id}
                            className="mt-1 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white text-xs font-bold px-3 py-1 rounded-lg">
                            {updatingId === o.id ? "…" : o.status === "PENDING" ? "Start Cooking" : "Mark Ready"}
                          </button>
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

      <div className="grid lg:grid-cols-2 gap-6">
        {/* New Orders */}
        <div>
          <h2 className="text-lg font-bold text-amber-700 mb-3 flex items-center gap-2">
            New Orders
            <span className="bg-amber-100 text-amber-700 text-sm font-bold rounded-full w-7 h-7 flex items-center justify-center">
              {pending.length}
            </span>
          </h2>
          <div className="space-y-3">
            {pending.length === 0 ? (
              <div className="text-center py-10 text-slate-400 bg-slate-50 rounded-2xl">No new orders</div>
            ) : pending.map((order) => (
              <OrderCard key={order.id} order={order} updatingId={updatingId}
                onUpdate={updateStatus} nextStatus="PREPARING" nextLabel="Start Cooking" />
            ))}
          </div>
        </div>

        {/* Preparing */}
        <div>
          <h2 className="text-lg font-bold text-blue-700 mb-3 flex items-center gap-2">
            Cooking
            <span className="bg-blue-100 text-blue-700 text-sm font-bold rounded-full w-7 h-7 flex items-center justify-center">
              {preparing.length}
            </span>
          </h2>
          <div className="space-y-3">
            {preparing.length === 0 ? (
              <div className="text-center py-10 text-slate-400 bg-slate-50 rounded-2xl">Nothing cooking</div>
            ) : preparing.map((order) => (
              <OrderCard key={order.id} order={order} updatingId={updatingId}
                onUpdate={updateStatus} nextStatus="READY" nextLabel="Mark Ready" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function OrderCard({
  order,
  updatingId,
  onUpdate,
  nextStatus,
  nextLabel,
}: {
  order: OrderData;
  updatingId: string | null;
  onUpdate: (id: string, status: OrderStatus) => void;
  nextStatus: OrderStatus;
  nextLabel: string;
}) {
  const colors = STATUS_COLORS[order.status];
  const isUpdating = updatingId === order.id;

  return (
    <div className={`rounded-xl border p-4 shadow-sm ${colors.bg} ${colors.border}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-bold text-slate-800">#{order.id.slice(-6).toUpperCase()}</p>
          <p className="text-slate-600 text-sm">{order.customerName}</p>
        </div>
        <div className="text-right">
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${colors.badge}`}>
            {order.type === "TABLE" ? `Table: ${order.table?.name ?? "?"}` : "Parcel"}
          </span>
          <p className="text-xs text-slate-400 mt-1">
            {new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      </div>
      <div className="space-y-1 mb-3">
        {order.items.map((item) => (
          <div key={item.id} className="flex justify-between text-sm">
            <div>
              <span className="font-medium text-slate-700">{item.name} × {item.quantity}</span>
              {item.notes && (
                <p className="text-xs font-bold text-amber-600 mt-0.5">🌶 {item.notes}</p>
              )}
            </div>
          </div>
        ))}
      </div>
      {order.notes && (
        <div className="bg-white/60 rounded-lg px-3 py-2 text-sm text-slate-600 italic mb-3">
          "{order.notes}"
        </div>
      )}
      <button
        onClick={() => onUpdate(order.id, nextStatus)}
        disabled={isUpdating}
        className="w-full bg-slate-800 hover:bg-slate-700 disabled:bg-slate-400 text-white text-sm font-bold py-2 rounded-lg transition-colors"
      >
        {isUpdating ? "..." : nextLabel}
      </button>
    </div>
  );
}

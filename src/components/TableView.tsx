"use client";

import { useEffect, useState, useCallback } from "react";
import { OrderStatus } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface LiveOrder {
  id: string;
  customerName: string;
  status: OrderStatus;
  total: number;
  items: OrderItem[];
  createdAt: string;
  upiUtr: string | null;
  paymentVerified: boolean;
  nudgeCount: number;
}

interface TableWithOrders {
  id: string;
  name: string;
  capacity: number;
  qrToken: string;
  orders: LiveOrder[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; badge: string; dot: string; nextActions: { label: string; value: OrderStatus }[] }
> = {
  PAYMENT_PENDING: {
    label: "Awaiting Payment",
    badge: "bg-purple-100 text-purple-700 border-purple-200",
    dot: "bg-purple-400",
    nextActions: [],
  },
  PENDING: {
    label: "Pending",
    badge: "bg-amber-100 text-amber-700 border-amber-200",
    dot: "bg-amber-400",
    nextActions: [{ label: "Start Preparing", value: "PREPARING" }],
  },
  PREPARING: {
    label: "Preparing",
    badge: "bg-blue-100 text-blue-700 border-blue-200",
    dot: "bg-blue-400",
    nextActions: [{ label: "Mark Ready", value: "READY" }],
  },
  READY: {
    label: "Ready to Serve",
    badge: "bg-green-100 text-green-700 border-green-200",
    dot: "bg-green-400",
    nextActions: [{ label: "Mark Done", value: "DONE" }],
  },
  DONE: {
    label: "Done",
    badge: "bg-slate-100 text-slate-600 border-slate-200",
    dot: "bg-slate-300",
    nextActions: [],
  },
  CANCELLED: {
    label: "Cancelled",
    badge: "bg-red-100 text-red-600 border-red-200",
    dot: "bg-red-300",
    nextActions: [],
  },
};

function getTableStatusColor(orders: LiveOrder[]): {
  border: string; bg: string; headerBg: string;
} {
  if (orders.length === 0)
    return { border: "border-slate-200", bg: "bg-white", headerBg: "bg-slate-50" };
  const hasReady = orders.some((o) => o.status === "READY");
  if (hasReady)
    return { border: "border-green-300", bg: "bg-green-50", headerBg: "bg-green-100" };
  const hasPending = orders.some((o) => o.status === "PAYMENT_PENDING" || o.status === "PENDING");
  if (hasPending)
    return { border: "border-amber-300", bg: "bg-amber-50", headerBg: "bg-amber-100" };
  return { border: "border-blue-200", bg: "bg-blue-50", headerBg: "bg-blue-100" };
}

function elapsedMins(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000);
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function TableView() {
  const [tables, setTables] = useState<TableWithOrders[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/table-view");
      if (res.ok) {
        const data: TableWithOrders[] = await res.json();
        setTables(data);
        setLastRefresh(new Date());
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 30_000);
    return () => clearInterval(t);
  }, [fetchData]);

  async function updateStatus(orderId: string, status: OrderStatus) {
    setUpdatingId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) fetchData();
    } finally {
      setUpdatingId(null);
    }
  }

  async function acceptPayment(orderId: string) {
    setUpdatingId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentAction: "ACCEPT" }),
      });
      if (res.ok) fetchData();
    } finally {
      setUpdatingId(null);
    }
  }

  const occupiedCount = tables.filter((t) => t.orders.length > 0).length;
  const totalRevenue = tables
    .flatMap((t) => t.orders)
    .reduce((sum, o) => sum + o.total, 0);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-48" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-36 bg-slate-200 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Table View</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {occupiedCount} of {tables.length} tables occupied ·{" "}
            {tables.flatMap((t) => t.orders).length} active orders
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">
            Last refresh: {lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
          <button
            onClick={fetchData}
            className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-1.5"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* ── Summary Chips ───────────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap mb-6">
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm">
          <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
          <span className="text-sm font-medium text-slate-700">Ready to Serve: {tables.flatMap((t) => t.orders).filter((o) => o.status === "READY").length}</span>
        </div>
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          <span className="text-sm font-medium text-slate-700">Pending: {tables.flatMap((t) => t.orders).filter((o) => o.status === "PENDING").length}</span>
        </div>
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
          <span className="text-sm font-medium text-slate-700">Preparing: {tables.flatMap((t) => t.orders).filter((o) => o.status === "PREPARING").length}</span>
        </div>
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm">
          <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
          <span className="text-sm font-medium text-slate-700">Awaiting Payment: {tables.flatMap((t) => t.orders).filter((o) => o.status === "PAYMENT_PENDING").length}</span>
        </div>
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm">
          <span className="text-sm font-semibold text-slate-700">Active Revenue: ₹{totalRevenue.toFixed(0)}</span>
        </div>
      </div>

      {tables.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <div className="text-5xl mb-3">🪑</div>
          <p className="text-lg font-medium">No tables set up yet</p>
          <p className="text-sm">Go to Tables &amp; QR to add tables</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {tables.map((table) => {
            const colors = getTableStatusColor(table.orders);
            const isExpanded = expandedTable === table.id;
            const tableTotal = table.orders.reduce((s, o) => s + o.total, 0);

            return (
              <div
                key={table.id}
                className={`rounded-2xl border-2 ${colors.border} ${colors.bg} shadow-sm transition-all duration-200 ${table.orders.length > 0 ? "cursor-pointer hover:shadow-md" : ""}`}
                onClick={() => table.orders.length > 0 && setExpandedTable(isExpanded ? null : table.id)}
              >
                {/* Table header */}
                <div className={`${colors.headerBg} rounded-t-2xl px-3 py-2.5 flex items-center justify-between`}>
                  <div>
                    <p className="font-bold text-slate-800 text-sm leading-tight">{table.name}</p>
                    <p className="text-xs text-slate-500">Cap: {table.capacity}</p>
                  </div>
                  {table.orders.length === 0 ? (
                    <span className="text-xs font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Free</span>
                  ) : (
                    <span className="text-xs font-bold bg-slate-800 text-white px-2 py-0.5 rounded-full">
                      {table.orders.length} order{table.orders.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                {/* Occupied info */}
                {table.orders.length > 0 && (
                  <div className="px-3 py-2">
                    {/* Status dots */}
                    <div className="flex gap-1 flex-wrap mb-2">
                      {table.orders.map((o) => (
                        <span
                          key={o.id}
                          className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_CONFIG[o.status].badge}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[o.status].dot}`} />
                          {STATUS_CONFIG[o.status].label}
                        </span>
                      ))}
                    </div>

                    {/* Total */}
                    <p className="text-sm font-bold text-slate-800">₹{tableTotal.toFixed(0)}</p>

                    <p className="text-xs text-slate-400 mt-0.5">
                      {isExpanded ? "▲ hide details" : "▼ view details"}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Expanded Order Panel ─────────────────────────────────────────── */}
      {expandedTable && (() => {
        const table = tables.find((t) => t.id === expandedTable);
        if (!table) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={() => setExpandedTable(null)}>
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Panel header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">{table.name}</h2>
                  <p className="text-sm text-slate-500">
                    {table.orders.length} active order{table.orders.length > 1 ? "s" : ""} ·{" "}
                    ₹{table.orders.reduce((s, o) => s + o.total, 0).toFixed(0)} total
                  </p>
                </div>
                <button
                  onClick={() => setExpandedTable(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500"
                >
                  ✕
                </button>
              </div>

              {/* Orders list */}
              <div className="divide-y divide-slate-100">
                {table.orders.map((order) => {
                  const elapsed = elapsedMins(order.createdAt);
                  const cfg = STATUS_CONFIG[order.status];
                  return (
                    <div key={order.id} className="px-5 py-4">
                      {/* Order meta */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div>
                          <p className="font-semibold text-slate-800 text-sm">{order.customerName}</p>
                          <p className="text-xs text-slate-400">{elapsed}m ago · #{order.id.slice(-6).toUpperCase()}</p>
                        </div>
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.badge}`}>
                          {cfg.label}
                        </span>
                      </div>

                      {/* Payment pending notice */}
                      {order.status === "PAYMENT_PENDING" && (
                        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 mb-3 flex items-center justify-between">
                          <div>
                            <p className="text-xs font-semibold text-purple-700">Awaiting Payment Verification</p>
                            {order.upiUtr && <p className="text-xs text-purple-500 mt-0.5">UTR: {order.upiUtr}</p>}
                          </div>
                          <button
                            disabled={updatingId === order.id}
                            onClick={() => acceptPayment(order.id)}
                            className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                          >
                            {updatingId === order.id ? "..." : "Accept"}
                          </button>
                        </div>
                      )}

                      {/* Items */}
                      <div className="bg-slate-50 rounded-xl p-3 mb-3 space-y-1">
                        {order.items.map((item) => (
                          <div key={item.id} className="flex justify-between text-sm">
                            <span className="text-slate-700">
                              <span className="font-medium">{item.quantity}×</span> {item.name}
                            </span>
                            <span className="text-slate-600 font-medium">₹{item.price.toFixed(0)}</span>
                          </div>
                        ))}
                        <div className="border-t border-slate-200 pt-1 mt-1 flex justify-between font-semibold text-slate-800">
                          <span>Total</span>
                          <span>₹{order.total.toFixed(0)}</span>
                        </div>
                      </div>

                      {/* Status actions */}
                      {cfg.nextActions.length > 0 && (
                        <div className="flex gap-2">
                          {cfg.nextActions.map((action) => (
                            <button
                              key={action.value}
                              disabled={updatingId === order.id}
                              onClick={() => updateStatus(order.id, action.value)}
                              className="flex-1 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-xl transition-colors"
                            >
                              {updatingId === order.id ? "Updating..." : action.label}
                            </button>
                          ))}
                          <button
                            disabled={updatingId === order.id}
                            onClick={() => updateStatus(order.id, "CANCELLED")}
                            className="bg-red-50 hover:bg-red-100 disabled:opacity-50 text-red-600 text-sm font-semibold px-3 py-2 rounded-xl transition-colors border border-red-200"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

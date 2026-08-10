"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { MenuItemData, OrderData, OrderStatus, OrgSettings } from "@/types";

/** Shared AudioContext — created once and reused to avoid suspension */
let sharedAudioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!sharedAudioCtx) sharedAudioCtx = new AudioCtx();
    // Resume if suspended (browser autoplay policy)
    if (sharedAudioCtx.state === "suspended") sharedAudioCtx.resume();
    return sharedAudioCtx;
  } catch { return null; }
}

/** Web-Audio beep — no external files needed */
function playBeep(type: "order" | "nudge") {
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    const play = (freq: number, start: number, duration: number) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.35, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    };
    if (type === "nudge") {
      play(1046, 0,    0.18);
      play(1318, 0.22, 0.18);
      play(1568, 0.44, 0.25);
    } else {
      play(660, 0,    0.3);
      play(880, 0.35, 0.4);
    }
  } catch { /* ignore */ }
}
import { printOrder } from "@/lib/printOrder";
import CreateOrderModal from "./CreateOrderModal";
import { estimateWaitMins, formatWait, getOrderUrgency, overdueByMins } from "@/lib/waitingTime";

const STATUS_COLORS: Record<string, { bg: string; border: string; badge: string }> = {
  PAYMENT_PENDING: { bg: "bg-purple-50", border: "border-purple-200", badge: "bg-purple-100 text-purple-700" },
  PENDING: { bg: "bg-amber-50", border: "border-amber-200", badge: "bg-amber-100 text-amber-700" },
  PREPARING: { bg: "bg-blue-50", border: "border-blue-200", badge: "bg-blue-100 text-blue-700" },
  READY: { bg: "bg-green-50", border: "border-green-200", badge: "bg-green-100 text-green-700" },
  DONE: { bg: "bg-slate-50", border: "border-slate-200", badge: "bg-slate-100 text-slate-600" },
  CANCELLED: { bg: "bg-red-50", border: "border-red-200", badge: "bg-red-100 text-red-600" },
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  PAYMENT_PENDING: "Awaiting Payment Verification",
  PENDING: "Pending",
  PREPARING: "Kitchen is preparing",
  READY: "Ready to serve",
  DONE: "Served",
  CANCELLED: "Cancelled",
};

export default function WaiterDashboard() {
  const { data: session } = useSession();
  const isAdmin = ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER"].includes(session?.user?.role ?? "");
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"PAYMENT_PENDING" | "ACTIVE" | "ALL">("ACTIVE");
  const [orgSettings, setOrgSettings] = useState<OrgSettings | null>(null);
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>({});
  const [tick, setTick] = useState(0);
  const [expandedScreenshot, setExpandedScreenshot] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [diningPopup, setDiningPopup] = useState<OrderData | null>(null);
  const [createOrderOpen, setCreateOrderOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const seenRepeatDinerIds = useState(() => new Set<string>())[0];
  const seenOrderIds    = useRef(new Set<string>());
  const lastNudgeCounts = useRef(new Map<string, number>());

  function enableSounds() {
    const ctx = getAudioCtx();
    if (ctx) {
      ctx.resume().then(() => {
        setSoundEnabled(true);
        // Play a soft confirmation beep
        playBeep("nudge");
      }).catch(() => setSoundEnabled(true));
    } else {
      setSoundEnabled(true);
    }
  }

  // Check if AudioContext is already running (some browsers auto-allow it)
  useEffect(() => {
    const ctx = getAudioCtx();
    if (ctx && ctx.state === "running") setSoundEnabled(true);
  }, []);

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
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  async function fetchOrders() {
    const res = await fetch("/api/orders");
    if (res.ok) {
      const data: OrderData[] = await res.json();
      const isFirstLoad = seenOrderIds.current.size === 0;

      // ── Sound + auto-switch filter for new orders ─────────────────────────
      if (!isFirstLoad) {
        const newOrders = data.filter(
          (o) => !seenOrderIds.current.has(o.id) &&
            ["PAYMENT_PENDING", "PENDING"].includes(o.status)
        );
        if (newOrders.length > 0) {
          playBeep("order");
          // Auto-switch tab: if new order is PAYMENT_PENDING and admin is on ACTIVE tab, switch to show it
          const hasNewPaymentPending = newOrders.some((o) => o.status === "PAYMENT_PENDING");
          const hasNewPending        = newOrders.some((o) => o.status === "PENDING");
          setFilter((prev) => {
            if (hasNewPaymentPending && prev === "ACTIVE") return "PAYMENT_PENDING";
            if (hasNewPending && prev === "PAYMENT_PENDING") return "ACTIVE";
            return prev;
          });
        }
      }
      data.forEach((o) => seenOrderIds.current.add(o.id));

      // ── Sound: nudge ───────────────────────────────────────────────────────
      data.forEach((o) => {
        const prev = lastNudgeCounts.current.get(o.id) ?? 0;
        if ((o.nudgeCount ?? 0) > prev) playBeep("nudge");
        lastNudgeCounts.current.set(o.id, o.nudgeCount ?? 0);
      });

      setOrders(data);

      // ── Repeat-diner popup ─────────────────────────────────────────────────
      const newRepeat = data.find(
        (o) => o.isRepeatDiner && !seenRepeatDinerIds.has(o.id) &&
          ["PENDING", "PAYMENT_PENDING", "PREPARING"].includes(o.status)
      );
      if (newRepeat) {
        seenRepeatDinerIds.add(newRepeat.id);
        setDiningPopup(newRepeat);
        setTimeout(() => setDiningPopup(null), 8000);
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 15000);
    return () => clearInterval(interval);
  }, []);

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

  const [bulkUpdating, setBulkUpdating] = useState(false);

  async function bulkUpdateStatus(fromStatus: OrderStatus, toStatus: OrderStatus) {
    const targets = orders.filter((o) => o.status === fromStatus);
    if (targets.length === 0) return;
    setBulkUpdating(true);
    try {
      await Promise.all(
        targets.map((o) =>
          fetch(`/api/orders/${o.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: toStatus }),
          })
        )
      );
      await fetchOrders();
    } finally {
      setBulkUpdating(false);
    }
  }

  async function verifyPayment(orderId: string, action: "ACCEPT" | "REJECT") {
    setUpdatingId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentAction: action }),
      });
      if (res.ok) {
        const updated = await res.json();
        setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      }
    } finally {
      setUpdatingId(null);
    }
  }

  const pendingPaymentOrders = orders.filter((o) => o.status === "PAYMENT_PENDING");

  // ── Today's Cash / UPI breakdown ──────────────────────────────────────────
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const confirmedToday = orders.filter((o) => {
    const notCancelled = !["CANCELLED", "PAYMENT_PENDING"].includes(o.status);
    const isToday = new Date(o.createdAt) >= todayStart;
    return notCancelled && isToday;
  });
  const cashTotal = confirmedToday
    .filter((o) => (o as unknown as { paymentMethod?: string }).paymentMethod === "CASH")
    .reduce((s, o) => s + o.total, 0);
  const upiTotal = confirmedToday
    .filter((o) => (o as unknown as { paymentMethod?: string }).paymentMethod !== "CASH")
    .reduce((s, o) => s + o.total, 0);
  const dayTotal = cashTotal + upiTotal;

  const q = search.trim().toLowerCase();
  const displayed = orders.filter((o) => {
    // Status filter
    const statusOk =
      filter === "PAYMENT_PENDING"
        ? o.status === "PAYMENT_PENDING"
        : filter === "ACTIVE"
        ? ["PENDING", "PREPARING", "READY"].includes(o.status)
        : o.status !== "PAYMENT_PENDING";
    if (!statusOk) return false;
    // Search filter — match order ID suffix, customer name, phone, table name
    if (!q) return true;
    return (
      o.id.slice(-6).toLowerCase().includes(q) ||
      o.customerName.toLowerCase().includes(q) ||
      (o.phone ?? "").toLowerCase().includes(q) ||
      (o.table?.name ?? "").toLowerCase().includes(q) ||
      o.items.some((i) => i.name.toLowerCase().includes(q))
    );
  });

  const readyCount = orders.filter((o) => o.status === "READY").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center">
          <div className="text-5xl animate-pulse mb-4">🤵</div>
          <p className="text-slate-500">Loading orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Sound enable banner — browsers block audio until user interaction */}
      {!soundEnabled && (
        <button
          onClick={enableSounds}
          className="w-full mb-4 bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 flex items-center gap-3 hover:bg-amber-100 transition-colors text-left"
        >
          <span className="text-2xl flex-shrink-0">🔔</span>
          <div className="flex-1">
            <p className="font-bold text-amber-800 text-sm">Tap to enable order notifications</p>
            <p className="text-amber-600 text-xs">Browsers require a tap before playing sounds. Click here once to activate.</p>
          </div>
          <span className="text-xs bg-amber-500 text-white font-bold px-3 py-1.5 rounded-lg flex-shrink-0">Enable</span>
        </button>
      )}

      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">My Orders</h1>
          <p className="text-slate-500 text-sm">Auto-refreshes every 15 seconds {soundEnabled ? "🔔" : "🔕"}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {readyCount > 0 && (
            <span className="animate-pulse bg-green-500 text-white font-bold px-3 py-2 rounded-xl text-sm">
              {readyCount} ready to serve!
            </span>
          )}
          <button
            onClick={() => setCreateOrderOpen(true)}
            className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 py-2 rounded-xl text-sm flex items-center gap-2 transition-colors shadow-sm"
          >
            ➕ New Order
          </button>
        </div>
      </div>

      {/* ── Bulk Actions — admin only ─────────────────────────────────────── */}
      {isAdmin && (() => {
        const preparingCount = orders.filter((o) => o.status === "PREPARING").length;
        const rCount = orders.filter((o) => o.status === "READY").length;
        if (preparingCount === 0 && rCount === 0) return null;
        return (
          <div className="flex items-center gap-2 mb-5 p-3 bg-slate-50 border border-slate-200 rounded-xl flex-wrap">
            <span className="text-xs font-semibold text-slate-500 mr-1">Bulk Actions:</span>
            {preparingCount > 0 && (
              <button
                onClick={() => {
                  if (confirm(`Mark all ${preparingCount} preparing order${preparingCount > 1 ? "s" : ""} as Ready?`))
                    bulkUpdateStatus("PREPARING", "READY");
                }}
                disabled={bulkUpdating}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors"
              >
                {bulkUpdating ? "⏳" : "✅"} Mark All Ready
                <span className="bg-blue-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">{preparingCount}</span>
              </button>
            )}
            {rCount > 0 && (
              <button
                onClick={() => {
                  if (confirm(`Mark all ${rCount} ready order${rCount > 1 ? "s" : ""} as Done / Served?`))
                    bulkUpdateStatus("READY", "DONE");
                }}
                disabled={bulkUpdating}
                className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors"
              >
                {bulkUpdating ? "⏳" : "🍽️"} Mark All Done
                <span className="bg-green-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">{rCount}</span>
              </button>
            )}
          </div>
        );
      })()}

      {createOrderOpen && orgSettings?.slug && (
        <CreateOrderModal
          orgSlug={orgSettings.slug}
          onClose={() => setCreateOrderOpen(false)}
          onCreated={() => { fetchOrders(); }}
        />
      )}

      {/* ── Today's Payment Summary (admins only) ────────────────────────── */}
      {isAdmin && dayTotal > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-center">
            <p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-1">💵 Cash Today</p>
            <p className="text-xl font-black text-green-700">₹{cashTotal.toFixed(0)}</p>
          </div>
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 text-center">
            <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-1">📲 UPI Today</p>
            <p className="text-xl font-black text-indigo-700">₹{upiTotal.toFixed(0)}</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center">
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1">🧾 Total Today</p>
            <p className="text-xl font-black text-amber-700">₹{dayTotal.toFixed(0)}</p>
          </div>
        </div>
      )}

      {/* ── Attention alerts ─────────────────────────────────────────────── */}
      {(() => {
        void tick;
        const activeOrders = orders.filter((o) => ["PENDING", "PREPARING", "READY"].includes(o.status));
        const overdue = activeOrders.filter((o) => getOrderUrgency(o, activeOrders, categoryMap) === "overdue");
        const near    = activeOrders.filter((o) => getOrderUrgency(o, activeOrders, categoryMap) === "near");
        if (overdue.length === 0 && near.length === 0) return null;
        return (
          <div className="mb-5 space-y-3">
            {overdue.length > 0 && (
              <div className="bg-red-50 border border-red-300 rounded-xl p-4">
                <h2 className="text-red-700 font-bold text-sm mb-3 flex items-center gap-2">
                  🚨 Overdue — Follow Up
                  <span className="bg-red-600 text-white text-xs rounded-full px-2 py-0.5">{overdue.length}</span>
                </h2>
                <div className="flex flex-col gap-2">
                  {overdue.map((o) => {
                    const late = overdueByMins(o, activeOrders, categoryMap);
                    return (
                      <div key={o.id} className="bg-white border border-red-200 rounded-lg px-4 py-3 flex items-center justify-between">
                        <div>
                          <span className="font-bold text-slate-800 text-sm">#{o.id.slice(-6).toUpperCase()}</span>
                          <span className="text-slate-500 text-xs ml-2">{o.customerName}</span>
                          <span className="text-slate-400 text-xs ml-2">{o.type === "TABLE" ? `🍽️ ${o.table?.name ?? "Table"}` : "📦 Parcel"}</span>
                          <div className="text-xs text-slate-500 mt-0.5">{o.items.map((i) => `${i.name} ×${i.quantity}`).join(", ")}</div>
                        </div>
                        <p className="text-red-600 font-extrabold text-sm shrink-0 ml-4">{late > 0 ? `+${late}m late` : "Due now"}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {near.length > 0 && (
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-4">
                <h2 className="text-amber-700 font-bold text-sm mb-3 flex items-center gap-2">
                  ⚠️ Almost Due
                  <span className="bg-amber-500 text-white text-xs rounded-full px-2 py-0.5">{near.length}</span>
                </h2>
                <div className="flex flex-col gap-2">
                  {near.map((o) => {
                    const rem = estimateWaitMins(o, activeOrders, categoryMap);
                    return (
                      <div key={o.id} className="bg-white border border-amber-200 rounded-lg px-4 py-3 flex items-center justify-between">
                        <div>
                          <span className="font-bold text-slate-800 text-sm">#{o.id.slice(-6).toUpperCase()}</span>
                          <span className="text-slate-500 text-xs ml-2">{o.customerName}</span>
                          <span className="text-slate-400 text-xs ml-2">{o.type === "TABLE" ? `🍽️ ${o.table?.name ?? "Table"}` : "📦 Parcel"}</span>
                          <div className="text-xs text-slate-500 mt-0.5">{o.items.map((i) => `${i.name} ×${i.quantity}`).join(", ")}</div>
                        </div>
                        <p className="text-amber-600 font-bold text-sm shrink-0 ml-4">⏱ {formatWait(rem)}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Search bar */}
      <div className="relative mb-4">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by order ID, customer name, phone, table…"
          className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-slate-400"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-lg"
          >
            ×
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-5 flex-wrap">
        <button
          onClick={() => setFilter("PAYMENT_PENDING")}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            filter === "PAYMENT_PENDING"
              ? "bg-purple-600 text-white"
              : pendingPaymentOrders.length > 0
                ? "bg-purple-100 border-2 border-purple-400 text-purple-700 animate-pulse"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
        >
          🔐 Pending Payment
          {pendingPaymentOrders.length > 0 && (
            <span className={`text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center ${filter === "PAYMENT_PENDING" ? "bg-white text-purple-600" : "bg-purple-600 text-white"}`}>
              {pendingPaymentOrders.length}
            </span>
          )}
        </button>
        {(["ACTIVE", "ALL"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === f
                ? "bg-slate-800 text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {f === "ACTIVE" ? "Active Orders" : "All Orders"}
          </button>
        ))}
        <button onClick={fetchOrders} className="ml-auto bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-4 py-1.5 rounded-full text-sm">
          Refresh
        </button>
      </div>

      {displayed.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <div className="text-5xl mb-3">{q ? "🔍" : "🍽️"}</div>
          <p>{q ? `No orders matching "${search}"` : "No orders here"}</p>
          {q && <button onClick={() => setSearch("")} className="mt-2 text-sm text-amber-600 hover:underline">Clear search</button>}
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map((order) => {
            const colors = STATUS_COLORS[order.status];
            const isUpdating = updatingId === order.id;

            return (
              <div key={order.id} className={`rounded-xl border p-4 shadow-sm ${colors.bg} ${colors.border} ${order.isRepeatDiner ? "ring-2 ring-amber-400" : ""}`}>
                {/* Repeat diner priority banner inside card */}
                {order.isRepeatDiner && (
                  <div className="bg-gradient-to-r from-amber-400 to-orange-400 rounded-lg px-3 py-1.5 flex items-center gap-2 mb-3">
                    <span className="text-base">🍽️⭐</span>
                    <p className="text-white text-xs font-bold">Priority — Customer is already dining</p>
                    <span className="ml-auto text-amber-100 text-xs">Eat slowly 😊</span>
                  </div>
                )}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold text-slate-800">
                      #{order.id.slice(-6).toUpperCase()}
                      <span className="ml-2 font-normal text-slate-600 text-sm">
                        {order.customerName}
                        {order.phone ? ` · ${order.phone}` : ""}
                      </span>
                    </p>
                    <p className="text-slate-500 text-sm mt-0.5">
                      {order.type === "TABLE" ? `Table: ${order.table?.name ?? "?"}` : "Parcel"} · {new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${colors.badge}`}>
                    {STATUS_LABELS[order.status]}
                  </span>
                </div>

                <div className="space-y-1 mb-3">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <div>
                        <span className="text-slate-700">{item.name} × {item.quantity}</span>
                        {item.notes && (
                          <p className="text-xs text-amber-600 font-medium">🌶 {item.notes}</p>
                        )}
                      </div>
                      <span className="text-slate-500">₹{(item.price * item.quantity).toFixed(0)}</span>
                    </div>
                  ))}
                </div>

                {order.notes && (
                  <div className="bg-white/60 rounded-lg px-3 py-2 text-sm text-slate-600 italic mb-3">
                    "{order.notes}"
                  </div>
                )}

                {/* Payment verification section */}
                {order.status === "PAYMENT_PENDING" && (
                  <div className="mb-3 space-y-2">
                    {/* Cash order — simple approval banner */}
                    {(order as { paymentMethod?: string }).paymentMethod === "CASH" ? (
                      <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex items-center gap-2">
                        <span className="text-xl">💵</span>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-green-800">Cash Payment</p>
                          <p className="text-xs text-green-600">Collect ₹{order.total.toFixed(0)} from customer</p>
                        </div>
                        {order.nudgeCount > 0 && (
                          <span className="flex items-center gap-1 text-xs bg-orange-100 text-orange-700 font-bold px-2 py-0.5 rounded-full">
                            🔔 {order.nudgeCount}
                          </span>
                        )}
                      </div>
                    ) : (
                      <>
                        {/* UPI — UTR (tap to copy) */}
                        {order.upiUtr && (
                          <button
                            type="button"
                            onClick={() => navigator.clipboard.writeText(order.upiUtr!).then(() => alert("UTR copied!"))}
                            className="w-full bg-white border border-purple-200 rounded-lg px-3 py-2 flex items-center gap-2 hover:bg-purple-50 active:scale-95 transition-all text-left"
                            title="Tap to copy UTR"
                          >
                            <span className="text-xs text-slate-500 font-medium">UTR:</span>
                            <span className="font-mono font-bold text-slate-800 text-sm flex-1">{order.upiUtr}</span>
                            <span className="text-xs text-purple-400">📋 Copy</span>
                            {order.nudgeCount > 0 && (
                              <span className="flex items-center gap-1 text-xs bg-orange-100 text-orange-700 font-bold px-2 py-0.5 rounded-full">
                                🔔 {order.nudgeCount}
                              </span>
                            )}
                          </button>
                        )}
                        {/* UPI — Screenshot thumbnail */}
                        {order.paymentScreenshot && (
                          <button
                            onClick={() => setExpandedScreenshot(order.paymentScreenshot)}
                            className="w-full rounded-lg overflow-hidden border border-purple-200 hover:border-purple-400 transition-colors relative"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={order.paymentScreenshot} alt="Payment screenshot" className="w-full max-h-32 object-cover" />
                            <div className="absolute inset-0 bg-black/10 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                              <span className="bg-black/60 text-white text-xs font-bold px-3 py-1 rounded-full">Tap to enlarge</span>
                            </div>
                          </button>
                        )}
                      </>
                    )}
                    {/* Accept / Reject — same for both cash and UPI */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => verifyPayment(order.id, "ACCEPT")}
                        disabled={isUpdating}
                        className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-bold py-2.5 rounded-lg text-sm transition-colors"
                      >
                        {isUpdating ? "..." : (order as { paymentMethod?: string }).paymentMethod === "CASH" ? "✅ Collected — Confirm Order" : "✅ Accept & Confirm Order"}
                      </button>
                      <button
                        onClick={() => verifyPayment(order.id, "REJECT")}
                        disabled={isUpdating}
                        className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white font-bold py-2.5 rounded-lg text-sm transition-colors"
                      >
                        {isUpdating ? "..." : "❌ Reject"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Cash order pending approval — collect & confirm */}
                {order.status === "PENDING" && (order as { paymentMethod?: string }).paymentMethod === "CASH" && (
                  <div className="mb-3 space-y-2">
                    <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex items-center gap-2">
                      <span className="text-xl">💵</span>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-green-800">Cash Payment</p>
                        <p className="text-xs text-green-600">Collect <span className="font-black">₹{order.total.toFixed(0)}</span> from customer before confirming</p>
                      </div>
                      {order.nudgeCount > 0 && (
                        <span className="flex items-center gap-1 text-xs bg-orange-100 text-orange-700 font-bold px-2 py-0.5 rounded-full animate-pulse">
                          🔔 {order.nudgeCount}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => verifyPayment(order.id, "ACCEPT")}
                        disabled={isUpdating}
                        className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-bold py-2.5 rounded-lg text-sm transition-colors"
                      >
                        {isUpdating ? "..." : "✅ Collected — Confirm Order"}
                      </button>
                      <button
                        onClick={() => verifyPayment(order.id, "REJECT")}
                        disabled={isUpdating}
                        className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white font-bold py-2.5 rounded-lg text-sm transition-colors"
                      >
                        {isUpdating ? "..." : "❌ Reject"}
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">₹{order.total.toFixed(0)}</span>
                  <div className="flex gap-2 items-center">
                    <button
                      onClick={() => printOrder(order, orgSettings)}
                      title="Print receipt"
                      className="text-slate-400 hover:text-slate-700 transition-colors text-base px-1"
                    >
                      🖨️
                    </button>
                    {/* PREPARING → READY */}
                    {order.status === "PREPARING" && (
                      <button
                        onClick={() => updateStatus(order.id, "READY")}
                        disabled={isUpdating}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-xs font-bold px-4 py-1.5 rounded-lg transition-colors"
                      >
                        {isUpdating ? "..." : "✅ Mark Ready"}
                      </button>
                    )}
                    {/* READY → DONE */}
                    {order.status === "READY" && (
                      <button
                        onClick={() => updateStatus(order.id, "DONE")}
                        disabled={isUpdating}
                        className="bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white text-xs font-bold px-4 py-1.5 rounded-lg transition-colors"
                      >
                        {isUpdating ? "..." : "🍽️ Mark Served"}
                      </button>
                    )}
                    {/* Cancel — for PREPARING and non-cash PENDING */}
                    {(order.status === "PREPARING" || (order.status === "PENDING" && (order as { paymentMethod?: string }).paymentMethod !== "CASH")) && (
                      <button
                        onClick={() => updateStatus(order.id, "CANCELLED")}
                        disabled={isUpdating}
                        className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Screenshot lightbox */}
      {expandedScreenshot && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setExpandedScreenshot(null)}
        >
          <div className="relative max-w-lg w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={expandedScreenshot}
              alt="Payment screenshot"
              className="w-full rounded-2xl shadow-2xl"
            />
            <button
              onClick={() => setExpandedScreenshot(null)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center text-slate-700 font-bold shadow-lg"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Dining customer popup toast */}
      {diningPopup && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[90vw] max-w-sm animate-bounce-once">
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl shadow-2xl px-5 py-4 flex items-start gap-4">
            <span className="text-3xl mt-0.5">🍽️</span>
            <div className="flex-1">
              <p className="text-white font-black text-sm">Already Dining — Priority Order!</p>
              <p className="text-amber-100 text-xs mt-1">
                <strong>{diningPopup.customerName}</strong>
                {diningPopup.table ? ` · ${diningPopup.table.name}` : ""} placed another order while dining.
              </p>
              <p className="text-amber-200 text-xs mt-0.5">Eat slowly &amp; enjoy 😊🌟 — Prioritizing this order.</p>
            </div>
            <button
              onClick={() => setDiningPopup(null)}
              className="text-amber-200 hover:text-white text-lg leading-none mt-0.5"
            >✕</button>
          </div>
        </div>
      )}
    </div>
  );
}

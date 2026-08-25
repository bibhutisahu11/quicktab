"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import QRCode from "qrcode";

/* ─── Types ─────────────────────────────────────────────── */

interface PreOrderItem {
  sweetId: string;
  name: string;
  pricePerUnit: number;
  unit: string;
  quantity: number;
  lineTotal: number;
}

interface PreOrder {
  id: string;
  customerName: string;
  phone: string;
  items: PreOrderItem[];
  totalAmount: number;
  status: string;
  notes?: string | null;
  adminNotes?: string | null;
  paymentDeadline?: string | null;
  createdAt: string;
}

interface Sweet {
  id: string;
  name: string;
  pricePerUnit: number;
  unit: string;
  available: boolean;
  sortOrder: number;
}

/* ─── Constants ─────────────────────────────────────────── */

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "PLACED", label: "Placed" },
  { value: "CUSTOMER_CONFIRMED", label: "Customer Confirmed" },
  { value: "PAYMENT_DONE", label: "Payment Done" },
  { value: "PICKED_UP", label: "Picked Up" },
  { value: "CANCELLED", label: "Cancelled" },
];

const STATUS_COLORS: Record<string, string> = {
  PLACED:             "bg-slate-100 text-slate-600",
  CUSTOMER_CONFIRMED: "bg-blue-100 text-blue-700",
  PAYMENT_DONE:       "bg-green-100 text-green-700",
  PICKED_UP:          "bg-purple-100 text-purple-600",
  CANCELLED:          "bg-red-100 text-red-600",
};

// Left border accent per status — makes cards visually distinct at a glance
const CARD_BORDER: Record<string, string> = {
  PLACED:             "border-l-4 border-l-slate-300  bg-white",
  CUSTOMER_CONFIRMED: "border-l-4 border-l-blue-400   bg-blue-50",
  PAYMENT_DONE:       "border-l-4 border-l-green-500  bg-green-50",
  PICKED_UP:          "border-l-4 border-l-purple-300 bg-slate-50 opacity-70",
  CANCELLED:          "border-l-4 border-l-red-300    bg-slate-50 opacity-60",
};

const STATUS_LABEL: Record<string, string> = {
  PLACED:             "Placed",
  CUSTOMER_CONFIRMED: "Customer Confirmed",
  PAYMENT_DONE:       "Payment Done",
  PICKED_UP:          "Picked Up",
  CANCELLED:          "Cancelled",
};

const NEXT_ACTIONS: Record<string, { label: string; nextStatus: string }[]> = {
  PLACED: [
    { label: "✅ Confirm Customer", nextStatus: "CUSTOMER_CONFIRMED" },
    { label: "✖ Cancel",           nextStatus: "CANCELLED" },
  ],
  CUSTOMER_CONFIRMED: [
    { label: "💰 Mark Payment Done", nextStatus: "PAYMENT_DONE" },
    { label: "✖ Cancel",             nextStatus: "CANCELLED" },
  ],
  PAYMENT_DONE: [
    { label: "🎁 Mark Picked Up", nextStatus: "PICKED_UP" },
  ],
  PICKED_UP:  [],
  CANCELLED:  [],
};

/* ─── CSV export helper ─────────────────────────────────── */

function exportCsv(orders: PreOrder[]) {
  const rows = [
    ["Order ID", "Customer", "Phone", "Items", "Total", "Status", "Payment Deadline", "Date"],
    ...orders.map((o) => [
      o.id.slice(-8).toUpperCase(),
      o.customerName,
      o.phone,
      o.items.map((i) => `${i.name}×${i.quantity}`).join(" | "),
      o.totalAmount.toFixed(2),
      STATUS_LABEL[o.status] ?? o.status,
      o.paymentDeadline ? new Date(o.paymentDeadline).toLocaleDateString("en-IN") : "",
      new Date(o.createdAt).toLocaleString("en-IN"),
    ]),
  ];
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pre-orders-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ─── Order Card ─────────────────────────────────────────── */

function OrderCard({
  order,
  onStatusChange,
  highlight = false,
}: {
  order: PreOrder;
  onStatusChange: (id: string, status: string, adminNotes?: string) => Promise<void>;
  highlight?: boolean;
}) {
  const [expanded, setExpanded] = useState(highlight); // auto-expand "action required" cards
  const [adminNotes, setAdminNotes] = useState(order.adminNotes ?? "");
  const [saving, setSaving] = useState(false);

  const actions = NEXT_ACTIONS[order.status] ?? [];
  const deadline = order.paymentDeadline
    ? new Date(order.paymentDeadline).toLocaleDateString("en-IN", {
        day: "numeric", month: "short", year: "numeric",
      })
    : null;

  const cardClass = CARD_BORDER[order.status] ?? "border-l-4 border-l-slate-200 bg-white";

  return (
    <div className={`rounded-xl shadow-sm border border-slate-100 overflow-hidden ${cardClass}`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs text-slate-400">#{order.id.slice(-8).toUpperCase()}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_COLORS[order.status] ?? "bg-slate-100 text-slate-600"}`}>
                {STATUS_LABEL[order.status] ?? order.status}
              </span>
              {highlight && (
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-orange-100 text-orange-600 animate-pulse">
                  ⚡ Action needed
                </span>
              )}
            </div>
            <p className="font-semibold text-slate-800 mt-1 text-base">{order.customerName}</p>
            {/* Click-to-call phone */}
            <a
              href={`tel:${order.phone}`}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium underline-offset-2 hover:underline"
            >
              📞 {order.phone}
            </a>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="font-bold text-slate-800 text-lg">₹{order.totalAmount.toFixed(2)}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {new Date(order.createdAt).toLocaleDateString("en-IN")}
            </p>
          </div>
        </div>

        {/* Item summary (collapsed) */}
        {!expanded && (
          <p className="text-sm text-slate-600 mt-2 truncate">
            {order.items.map((i) => `${i.name} ×${i.quantity}`).join(", ")}
          </p>
        )}

        {deadline && (
          <p className="text-xs text-amber-600 mt-1 font-medium">⏰ Payment by: {deadline}</p>
        )}

        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-amber-600 hover:text-amber-700 mt-2 font-medium"
        >
          {expanded ? "Hide details ▲" : "Show details ▼"}
        </button>

        {/* Expanded details */}
        {expanded && (
          <div className="mt-3 space-y-3">
            <div className="bg-white/80 rounded-lg p-3 space-y-1 border border-slate-100">
              {order.items.map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-slate-700">
                    {item.name} <span className="text-slate-400">×{item.quantity} {item.unit}</span>
                  </span>
                  <span className="text-slate-800 font-medium">₹{item.lineTotal.toFixed(2)}</span>
                </div>
              ))}
              <div className="border-t border-slate-200 mt-2 pt-2 flex justify-between font-bold text-sm">
                <span>Total</span>
                <span>₹{order.totalAmount.toFixed(2)}</span>
              </div>
            </div>

            {order.notes && (
              <p className="text-sm text-slate-600 bg-amber-50 rounded-lg px-3 py-2">
                <span className="font-medium">Customer note:</span> {order.notes}
              </p>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Admin Notes</label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={2}
                placeholder="Internal notes..."
                className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 text-slate-800 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
              />
              <button
                onClick={async () => {
                  setSaving(true);
                  await onStatusChange(order.id, order.status, adminNotes);
                  setSaving(false);
                }}
                disabled={saving}
                className="mt-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save Notes"}
              </button>
            </div>
          </div>
        )}

        {/* Action buttons */}
        {actions.length > 0 && (
          <div className="flex gap-2 mt-3 flex-wrap">
            {actions.map((action) => (
              <button
                key={action.nextStatus}
                onClick={async () => {
                  setSaving(true);
                  await onStatusChange(order.id, action.nextStatus);
                  setSaving(false);
                }}
                disabled={saving}
                className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors disabled:opacity-50 ${
                  action.nextStatus === "CANCELLED"
                    ? "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                    : "bg-amber-500 text-white hover:bg-amber-600 shadow-sm"
                }`}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── QR Download ────────────────────────────────────────── */

function PreOrderQR({ orgSlug }: { orgSlug: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const url = typeof window !== "undefined"
    ? `${window.location.origin}/${orgSlug}/preorder`
    : `https://ordertab.vercel.app/${orgSlug}/preorder`;

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, url, { width: 200, margin: 2 });
    }
  }, [url]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = "preorder-qr.png";
    a.click();
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 flex flex-col items-center gap-3">
      <h3 className="font-semibold text-slate-700 self-start">🔗 Pre-Order Link & QR</h3>
      <input
        readOnly
        value={url}
        className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 text-slate-600 bg-slate-50 focus:outline-none"
        onClick={(e) => (e.target as HTMLInputElement).select()}
      />
      <canvas ref={canvasRef} className="rounded-lg border border-slate-100 shadow-sm" />
      <button
        onClick={handleDownload}
        className="w-full py-2 bg-amber-500 text-white text-sm font-semibold rounded-xl hover:bg-amber-600 transition-colors"
      >
        ⬇ Download QR Code
      </button>
    </div>
  );
}

/* ─── Sweet Catalog Tab ──────────────────────────────────── */

function SweetCatalog() {
  const [sweets, setSweets] = useState<Sweet[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", pricePerUnit: "", unit: "piece" });
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", pricePerUnit: "", unit: "piece" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/pre-order-sweets");
      if (res.ok) setSweets(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.pricePerUnit) return;
    setSaving(true);
    try {
      const res = await fetch("/api/pre-order-sweets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name.trim(), pricePerUnit: parseFloat(form.pricePerUnit), unit: form.unit }),
      });
      if (res.ok) { setForm({ name: "", pricePerUnit: "", unit: "piece" }); await load(); }
    } finally { setSaving(false); }
  };

  const handleEdit = async (id: string) => {
    setSaving(true);
    try {
      await fetch(`/api/pre-order-sweets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editForm.name.trim(), pricePerUnit: parseFloat(editForm.pricePerUnit), unit: editForm.unit }),
      });
      setEditId(null);
      await load();
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this sweet?")) return;
    await fetch(`/api/pre-order-sweets/${id}`, { method: "DELETE" });
    await load();
  };

  const handleToggleAvailable = async (sweet: Sweet) => {
    await fetch(`/api/pre-order-sweets/${sweet.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ available: !sweet.available }),
    });
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm p-4">
        <h3 className="font-semibold text-slate-700 mb-3">Add New Sweet</h3>
        <form onSubmit={handleAdd} className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-36">
            <label className="block text-xs text-slate-500 mb-1">Name</label>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Sweet name" required
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 text-slate-800 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <div className="w-28">
            <label className="block text-xs text-slate-500 mb-1">Price (₹)</label>
            <input type="number" min="0" step="0.01" value={form.pricePerUnit}
              onChange={(e) => setForm((f) => ({ ...f, pricePerUnit: e.target.value }))}
              placeholder="0.00" required
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 text-slate-800 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <div className="w-28">
            <label className="block text-xs text-slate-500 mb-1">Unit</label>
            <select value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400">
              <option value="piece">piece</option>
              <option value="100g">100g</option>
              <option value="kg">kg</option>
            </select>
          </div>
          <button type="submit" disabled={saving}
            className="px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50">
            {saving ? "Adding…" : "Add"}
          </button>
        </form>
      </div>

      {loading ? (
        <div className="text-center text-slate-400 py-8">Loading…</div>
      ) : sweets.length === 0 ? (
        <div className="text-center text-slate-400 py-8">No sweets added yet.</div>
      ) : (
        <div className="space-y-2">
          {sweets.map((sweet) => (
            <div key={sweet.id} className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3">
              {editId === sweet.id ? (
                <div className="flex-1 flex flex-wrap gap-2 items-end">
                  <input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                    className="flex-1 min-w-28 px-2 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400" />
                  <input type="number" min="0" step="0.01" value={editForm.pricePerUnit}
                    onChange={(e) => setEditForm((f) => ({ ...f, pricePerUnit: e.target.value }))}
                    className="w-24 px-2 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400" />
                  <select value={editForm.unit} onChange={(e) => setEditForm((f) => ({ ...f, unit: e.target.value }))}
                    className="w-24 px-2 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400">
                    <option value="piece">piece</option>
                    <option value="100g">100g</option>
                    <option value="kg">kg</option>
                  </select>
                  <button onClick={() => handleEdit(sweet.id)} disabled={saving}
                    className="px-3 py-1.5 text-xs bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50">Save</button>
                  <button onClick={() => setEditId(null)}
                    className="px-3 py-1.5 text-xs bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200">Cancel</button>
                </div>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold ${sweet.available ? "text-slate-800" : "text-slate-400 line-through"}`}>{sweet.name}</p>
                    <p className="text-sm text-slate-500">₹{sweet.pricePerUnit.toFixed(2)} / {sweet.unit}</p>
                  </div>
                  <button onClick={() => handleToggleAvailable(sweet)}
                    className={`text-xs px-2 py-1 rounded-full font-medium ${sweet.available ? "bg-green-50 text-green-600" : "bg-slate-100 text-slate-500"}`}>
                    {sweet.available ? "Available" : "Hidden"}
                  </button>
                  <button onClick={() => { setEditId(sweet.id); setEditForm({ name: sweet.name, pricePerUnit: String(sweet.pricePerUnit), unit: sweet.unit }); }}
                    className="text-xs px-2 py-1 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100">Edit</button>
                  <button onClick={() => handleDelete(sweet.id)}
                    className="text-xs px-2 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100">Delete</button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────── */

export default function PreOrderManager({ orgSlug }: { orgSlug: string }) {
  const [tab, setTab] = useState<"orders" | "catalog" | "qr">("orders");
  const [orders, setOrders] = useState<PreOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const url = statusFilter
        ? `/api/pre-orders?status=${encodeURIComponent(statusFilter)}`
        : "/api/pre-orders";
      const res = await fetch(url);
      if (res.ok) setOrders(await res.json());
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    if (tab === "orders") loadOrders();
  }, [tab, loadOrders]);

  const handleStatusChange = async (id: string, status: string, adminNotes?: string) => {
    const body: Record<string, string> = { status };
    if (adminNotes !== undefined) body.adminNotes = adminNotes;
    await fetch(`/api/pre-orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    await loadOrders();
  };

  // Split orders into "needs action" vs rest
  const actionOrders = orders.filter((o) => ["PLACED", "CUSTOMER_CONFIRMED", "PAYMENT_DONE"].includes(o.status));
  const doneOrders   = orders.filter((o) => ["PICKED_UP", "CANCELLED"].includes(o.status));

  // Filter applies only when explicitly selected
  const filteredOrders = statusFilter
    ? orders
    : null; // null = use split view

  return (
    <div className="md:ml-56 min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Pre-Orders 🎁</h1>
            <p className="text-slate-500 text-sm mt-0.5">Manage Raksha Bandhan sweet pre-orders</p>
          </div>
          {tab === "orders" && orders.length > 0 && (
            <button
              onClick={() => exportCsv(orders)}
              className="text-sm px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 shadow-sm transition-colors"
            >
              Export CSV
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-xl shadow-sm p-1 mb-6 w-fit">
          {(["orders", "catalog", "qr"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                tab === t
                  ? "bg-amber-500 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {t === "orders" ? `Pre-Orders${actionOrders.length > 0 ? ` (${actionOrders.length})` : ""}` : t === "catalog" ? "Sweet Catalog" : "QR Code"}
            </button>
          ))}
        </div>

        {tab === "catalog" && <SweetCatalog />}
        {tab === "qr"      && <PreOrderQR orgSlug={orgSlug} />}

        {tab === "orders" && (
          <div className="space-y-5">
            {/* Status filter pills */}
            <div className="flex gap-2 flex-wrap">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setStatusFilter(opt.value)}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                    statusFilter === opt.value
                      ? "bg-amber-500 text-white"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="text-center text-slate-400 py-12">Loading orders…</div>
            ) : orders.length === 0 ? (
              <div className="text-center text-slate-400 py-12 bg-white rounded-xl shadow-sm">
                No pre-orders found.
              </div>
            ) : filteredOrders !== null ? (
              /* Specific status filter active — flat list */
              <div className="space-y-3">
                {filteredOrders.map((order) => (
                  <OrderCard key={order.id} order={order} onStatusChange={handleStatusChange} />
                ))}
              </div>
            ) : (
              /* Default "All" — split view */
              <>
                {actionOrders.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-sm font-bold text-orange-600 uppercase tracking-wide">⚡ Action Required</span>
                      <span className="bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{actionOrders.length}</span>
                    </div>
                    <div className="space-y-3">
                      {actionOrders.map((order) => (
                        <OrderCard key={order.id} order={order} onStatusChange={handleStatusChange} highlight />
                      ))}
                    </div>
                  </div>
                )}

                {doneOrders.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Completed / Cancelled</p>
                    <div className="space-y-3">
                      {doneOrders.map((order) => (
                        <OrderCard key={order.id} order={order} onStatusChange={handleStatusChange} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useSession } from "next-auth/react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface CreditCustomer {
  id: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  active: boolean;
  outstanding: number;
}

interface BillItem {
  name: string;
  qty: number;
  price: number; // unit price
}

interface CreditEntry {
  id: string;
  customerId: string;
  type: "BILL" | "PAYMENT";
  amount: number;
  items?: BillItem[] | null;
  description?: string | null;
  date: string;
  notes?: string | null;
  createdAt: string;
}

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  available: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function todayStr() { return new Date().toISOString().slice(0, 10); }
function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function fmtAmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

const INPUT_CLS = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-400";

// ── Component ─────────────────────────────────────────────────────────────────
export default function CreditBook() {
  const { data: session } = useSession();
  const role = session?.user?.role ?? "";
  const isAdmin = ["HOTEL_ADMIN", "MANAGER", "SUPER_ADMIN", "BILLER"].includes(role);
  const canDelete = ["HOTEL_ADMIN", "MANAGER", "SUPER_ADMIN"].includes(role);

  // ── Tabs (customer list view) ──────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"customers" | "logs">("customers");

  // ── Customer list ──────────────────────────────────────────────────────────
  const [customers, setCustomers] = useState<CreditCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // ── All-logs (admin tab) ───────────────────────────────────────────────────
  interface AllLogEntry extends CreditEntry { customer: { id: string; name: string; phone?: string | null } }
  const [allLogs, setAllLogs] = useState<AllLogEntry[]>([]);
  const [allLogsLoading, setAllLogsLoading] = useState(false);
  const [allLogsLoaded, setAllLogsLoaded] = useState(false);
  const [logsSearch, setLogsSearch] = useState("");

  const loadAllLogs = useCallback(async () => {
    setAllLogsLoading(true);
    const res = await fetch("/api/credit-entries?all=true");
    if (res.ok) setAllLogs(await res.json());
    setAllLogsLoaded(true);
    setAllLogsLoading(false);
  }, []);

  // ── Selected customer (ledger view) ───────────────────────────────────────
  const [selected, setSelected] = useState<CreditCustomer | null>(null);
  const [entries, setEntries] = useState<CreditEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);

  // ── Add customer form ──────────────────────────────────────────────────────
  const [showCustForm, setShowCustForm] = useState(false);
  const [editCust, setEditCust] = useState<CreditCustomer | null>(null);
  const [custForm, setCustForm] = useState({ name: "", phone: "", address: "", notes: "" });
  const [custSaving, setCustSaving] = useState(false);

  // ── Add Bill modal ─────────────────────────────────────────────────────────
  const [showBill, setShowBill] = useState(false);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuLoaded, setMenuLoaded] = useState(false);
  const [billSearch, setBillSearch] = useState("");
  const [cart, setCart] = useState<BillItem[]>([]);
  const [billDate, setBillDate] = useState(todayStr());
  const [billNotes, setBillNotes] = useState("");
  const [billSaving, setBillSaving] = useState(false);
  const [billError, setBillError] = useState("");
  const billSearchRef = useRef<HTMLInputElement>(null);

  // ── Payment modal ──────────────────────────────────────────────────────────
  const [showPayment, setShowPayment] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(todayStr());
  const [payNotes, setPayNotes] = useState("");
  const [paySaving, setPaySaving] = useState(false);

  // ── Load customers ─────────────────────────────────────────────────────────
  const loadCustomers = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/credit-customers");
    if (res.ok) setCustomers(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  // ── Load entries for selected customer ────────────────────────────────────
  const loadEntries = useCallback(async (customerId: string) => {
    setEntriesLoading(true);
    const res = await fetch(`/api/credit-entries?customerId=${customerId}`);
    if (res.ok) setEntries(await res.json());
    setEntriesLoading(false);
  }, []);

  useEffect(() => {
    if (selected) loadEntries(selected.id);
  }, [selected, loadEntries]);

  // ── Load menu (lazy, once) ─────────────────────────────────────────────────
  const loadMenu = useCallback(async () => {
    if (menuLoaded) return;
    const res = await fetch("/api/menu");
    if (res.ok) {
      const data = await res.json();
      setMenuItems((data.items ?? data).filter((i: MenuItem) => i.available !== false));
      setMenuLoaded(true);
    }
  }, [menuLoaded]);

  // ── Filtered menu ──────────────────────────────────────────────────────────
  const filteredMenu = useMemo(() => {
    const q = billSearch.trim().toLowerCase();
    if (!q) return menuItems.slice(0, 40);
    return menuItems.filter(
      (m) => m.name.toLowerCase().includes(q) || m.category.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [menuItems, billSearch]);

  // ── Filtered all-logs ─────────────────────────────────────────────────────
  const filteredLogs = useMemo(() => {
    const q = logsSearch.trim().toLowerCase();
    if (!q) return allLogs;
    return allLogs.filter(
      (e) =>
        e.customer.name.toLowerCase().includes(q) ||
        (e.customer.phone ?? "").includes(q) ||
        (e.description ?? "").toLowerCase().includes(q) ||
        (e.notes ?? "").toLowerCase().includes(q)
    );
  }, [allLogs, logsSearch]);

  // ── Filtered customers ─────────────────────────────────────────────────────
  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.phone ?? "").includes(q)
    );
  }, [customers, search]);

  // ── Cart helpers ───────────────────────────────────────────────────────────
  function addToCart(item: MenuItem) {
    setCart((prev) => {
      const idx = prev.findIndex((x) => x.name === item.name);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [...prev, { name: item.name, qty: 1, price: item.price }];
    });
  }

  function setCartQty(name: string, qty: number) {
    if (qty <= 0) {
      setCart((prev) => prev.filter((x) => x.name !== name));
    } else {
      setCart((prev) => prev.map((x) => x.name === name ? { ...x, qty } : x));
    }
  }

  const billTotal = cart.reduce((s, x) => s + x.price * x.qty, 0);

  // ── Open bill modal ────────────────────────────────────────────────────────
  function openBill() {
    setCart([]);
    setBillSearch("");
    setBillDate(todayStr());
    setBillNotes("");
    setBillError("");
    setShowBill(true);
    loadMenu();
    setTimeout(() => billSearchRef.current?.focus(), 100);
  }

  // ── Save bill ──────────────────────────────────────────────────────────────
  async function saveBill() {
    if (!selected || cart.length === 0) return;
    setBillSaving(true);
    setBillError("");
    try {
      const res = await fetch("/api/credit-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selected.id,
          type: "BILL",
          amount: billTotal,
          items: cart,
          date: billDate,
          notes: billNotes || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setBillError(err.error ?? "Failed to save bill. Please try again.");
        setBillSaving(false);
        return;
      }
      // Reload entries and customer list
      const [, custRes] = await Promise.all([
        loadEntries(selected.id),
        fetch("/api/credit-customers"),
      ]);
      if (custRes.ok) {
        const list: CreditCustomer[] = await custRes.json();
        setCustomers(list);
        const upd = list.find((c) => c.id === selected.id);
        if (upd) setSelected(upd);
      }
      setShowBill(false);
    } catch {
      setBillError("Network error. Please try again.");
    } finally {
      setBillSaving(false);
    }
  }

  // ── Save payment ───────────────────────────────────────────────────────────
  async function savePayment() {
    if (!selected || !payAmount) return;
    setPaySaving(true);
    try {
      const res = await fetch("/api/credit-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selected.id,
          type: "PAYMENT",
          amount: parseFloat(payAmount),
          date: payDate,
          notes: payNotes || null,
        }),
      });
      if (!res.ok) { setPaySaving(false); return; }
      const [, custRes] = await Promise.all([
        loadEntries(selected.id),
        fetch("/api/credit-customers"),
      ]);
      if (custRes.ok) {
        const list: CreditCustomer[] = await custRes.json();
        setCustomers(list);
        const upd = list.find((c) => c.id === selected.id);
        if (upd) setSelected(upd);
      }
      setShowPayment(false);
      setPayAmount("");
      setPayNotes("");
    } finally {
      setPaySaving(false);
    }
  }

  // ── Delete entry ───────────────────────────────────────────────────────────
  async function deleteEntry(id: string) {
    if (!confirm("Delete this entry?")) return;
    await fetch(`/api/credit-entries/${id}`, { method: "DELETE" });
    if (selected) {
      await loadEntries(selected.id);
      const fresh = await fetch("/api/credit-customers");
      if (fresh.ok) {
        const list: CreditCustomer[] = await fresh.json();
        const upd = list.find((c) => c.id === selected.id);
        if (upd) { setSelected(upd); setCustomers(list); }
      }
    }
  }

  // ── Customer form ──────────────────────────────────────────────────────────
  function openAddCust() {
    setEditCust(null);
    setCustForm({ name: "", phone: "", address: "", notes: "" });
    setShowCustForm(true);
  }

  function openEditCust(c: CreditCustomer) {
    setEditCust(c);
    setCustForm({ name: c.name, phone: c.phone ?? "", address: c.address ?? "", notes: c.notes ?? "" });
    setShowCustForm(true);
  }

  async function saveCust(e: React.FormEvent) {
    e.preventDefault();
    if (!custForm.name.trim()) return;
    setCustSaving(true);
    if (editCust) {
      await fetch(`/api/credit-customers/${editCust.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(custForm),
      });
    } else {
      await fetch("/api/credit-customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(custForm),
      });
    }
    await loadCustomers();
    setShowCustForm(false);
    setCustSaving(false);
  }

  async function toggleActive(c: CreditCustomer) {
    await fetch(`/api/credit-customers/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !c.active }),
    });
    await loadCustomers();
    if (selected?.id === c.id) setSelected({ ...selected, active: !c.active });
  }

  async function deleteCust(c: CreditCustomer) {
    if (!confirm(`Delete "${c.name}" and all their credit history?`)) return;
    await fetch(`/api/credit-customers/${c.id}`, { method: "DELETE" });
    if (selected?.id === c.id) setSelected(null);
    await loadCustomers();
  }

  // ── WhatsApp summary ───────────────────────────────────────────────────────
  function sendWhatsApp(c: CreditCustomer) {
    if (!c.phone) return;
    const orgName = session?.user?.orgName ?? "Us";
    const lines = [`*${orgName} – Credit Statement*`, `Customer: *${c.name}*`, ""];
    const outstanding = Math.max(0, c.outstanding);
    lines.push(`Outstanding balance: *${fmtAmt(outstanding)}*`);
    lines.push("", "Please settle at your earliest convenience.");
    const msg = encodeURIComponent(lines.join("\n"));
    window.open(`https://wa.me/91${c.phone.replace(/\D/g, "")}?text=${msg}`, "_blank");
  }

  // ── Totals ─────────────────────────────────────────────────────────────────
  const totalOutstanding = customers.reduce((s, c) => s + Math.max(0, c.outstanding), 0);

  // ── Render: Customer list ──────────────────────────────────────────────────
  if (!selected) {
    return (
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-black text-slate-800">📒 Credit Book</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Total outstanding: <span className="font-bold text-red-600">{fmtAmt(totalOutstanding)}</span>
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={openAddCust}
              className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-colors"
            >
              ＋ Add Customer
            </button>
          )}
        </div>

        {/* Tabs (admin only gets Logs tab) */}
        {canDelete && (
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
            <button
              onClick={() => setActiveTab("customers")}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${activeTab === "customers" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}
            >
              👥 Customers
            </button>
            <button
              onClick={() => { setActiveTab("logs"); if (!allLogsLoaded) loadAllLogs(); }}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${activeTab === "logs" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}
            >
              📋 All Logs
            </button>
          </div>
        )}

        {/* Search */}
        {activeTab === "customers" && (
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or phone…"
          className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-400"
        />
        )}

        {/* All Logs panel */}
        {activeTab === "logs" && canDelete && (
          <div className="space-y-3">
            <input
              type="text"
              value={logsSearch}
              onChange={(e) => setLogsSearch(e.target.value)}
              placeholder="Search by customer, description…"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-400"
            />
            {allLogsLoading ? (
              <div className="text-center py-12 text-slate-400">Loading…</div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-12 text-slate-400">No entries yet</div>
            ) : (
              filteredLogs.map((e) => (
                <div key={e.id} className={`bg-white border-l-4 rounded-2xl p-4 shadow-sm ${e.type === "BILL" ? "border-l-red-400" : "border-l-green-400"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${e.type === "BILL" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                          {e.type}
                        </span>
                        <button
                          onClick={() => { const c = customers.find((c) => c.id === e.customer.id); if (c) setSelected(c); }}
                          className="text-xs font-bold text-slate-700 hover:text-red-600 hover:underline"
                        >
                          {e.customer.name}
                        </button>
                        <span className="text-xs text-slate-400">{fmtDate(e.date)}</span>
                      </div>
                      {e.type === "BILL" && e.items && (e.items as BillItem[]).length > 0 && (
                        <div className="mt-1.5 space-y-0.5">
                          {(e.items as BillItem[]).map((item, i) => (
                            <p key={i} className="text-xs text-slate-600">
                              {item.name} ×{item.qty}
                              <span className="text-slate-400 ml-1">— ₹{(item.price * item.qty).toFixed(0)}</span>
                            </p>
                          ))}
                        </div>
                      )}
                      {e.notes && <p className="text-xs text-slate-400 mt-0.5 italic">{e.notes}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-lg font-black ${e.type === "BILL" ? "text-red-600" : "text-green-600"}`}>
                        {e.type === "BILL" ? "−" : "+"} ₹{e.amount.toFixed(0)}
                      </span>
                      <button
                        onClick={() => deleteEntry(e.id).then(loadAllLogs)}
                        className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-red-100 flex items-center justify-center text-slate-400 hover:text-red-500 text-xs transition-colors"
                        title="Delete entry"
                      >✕</button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Customer list */}
        {activeTab === "customers" && (
        <>
        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading…</div>
        ) : filteredCustomers.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <p className="text-4xl mb-3">📒</p>
            <p className="font-semibold">No credit customers yet</p>
            {isAdmin && <p className="text-xs mt-1">Click "Add Customer" to get started</p>}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredCustomers.map((c) => (
              <div
                key={c.id}
                className={`bg-white border-2 rounded-2xl p-4 shadow-sm cursor-pointer hover:border-red-300 transition-colors ${
                  !c.active ? "opacity-60" : c.outstanding > 0 ? "border-red-200" : "border-green-200"
                }`}
                onClick={() => setSelected(c)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center font-black text-lg flex-shrink-0 ${
                      c.outstanding > 0 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                    }`}>
                      {c.name[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 truncate">{c.name}</p>
                      {c.phone && <p className="text-xs text-slate-400">{c.phone}</p>}
                      {!c.active && <span className="text-xs text-slate-400">Inactive</span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-lg font-black ${c.outstanding > 0 ? "text-red-600" : "text-green-600"}`}>
                      {c.outstanding > 0 ? `− ${fmtAmt(c.outstanding)}` : "✓ Clear"}
                    </p>
                    <p className="text-xs text-slate-400">{c.outstanding > 0 ? "outstanding" : "tap to add bill"}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        </>
        )}

        {/* Add/Edit customer modal */}
        {showCustForm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4">
              <h3 className="text-lg font-black text-slate-800">
                {editCust ? "Edit Customer" : "Add Credit Customer"}
              </h3>
              <form onSubmit={saveCust} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Name *</label>
                  <input
                    type="text"
                    value={custForm.name}
                    onChange={(e) => setCustForm((p) => ({ ...p, name: e.target.value }))}
                    required
                    placeholder="Customer name"
                    className={INPUT_CLS}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={custForm.phone}
                    onChange={(e) => setCustForm((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="10-digit mobile"
                    className={INPUT_CLS}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Address</label>
                  <input
                    type="text"
                    value={custForm.address}
                    onChange={(e) => setCustForm((p) => ({ ...p, address: e.target.value }))}
                    placeholder="Optional address"
                    className={INPUT_CLS}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Notes</label>
                  <input
                    type="text"
                    value={custForm.notes}
                    onChange={(e) => setCustForm((p) => ({ ...p, notes: e.target.value }))}
                    placeholder="Optional notes"
                    className={INPUT_CLS}
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCustForm(false)}
                    className="flex-1 border border-slate-300 text-slate-600 font-semibold py-2.5 rounded-xl text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={custSaving}
                    className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white font-black py-2.5 rounded-xl text-sm transition-colors"
                  >
                    {custSaving ? "Saving…" : editCust ? "Save Changes" : "Add Customer"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Render: Customer ledger ────────────────────────────────────────────────
  const runningBalance = (() => {
    let bal = 0;
    return [...entries].reverse().map((e) => {
      bal += e.type === "BILL" ? e.amount : -e.amount;
      return { id: e.id, balance: bal };
    }).reverse();
  })();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setSelected(null)}
          className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 font-bold transition-colors"
        >
          ←
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-black text-slate-800 truncate">{selected.name}</h1>
          {selected.phone && <p className="text-xs text-slate-400">{selected.phone}</p>}
        </div>
        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {selected.phone && (
            <button
              onClick={() => sendWhatsApp(selected)}
              className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white font-bold px-3 py-2 rounded-xl text-xs transition-colors"
            >
              📲 WhatsApp
            </button>
          )}
          <button
            onClick={() => { setPayAmount(String(Math.max(0, Math.round(selected.outstanding)))); setPayDate(todayStr()); setPayNotes(""); setShowPayment(true); }}
            className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white font-bold px-3 py-2 rounded-xl text-xs transition-colors"
          >
            💵 Payment
          </button>
          <button
            onClick={openBill}
            className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white font-bold px-3 py-2 rounded-xl text-xs transition-colors"
          >
            ＋ Add Bill
          </button>
              {isAdmin && (
                <>
                  <button
                    onClick={() => openEditCust(selected)}
                    className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 text-sm transition-colors"
                    title="Edit customer"
                  >
                    ✏️
                  </button>
                  {canDelete && (
                    <>
                      <button
                        onClick={() => toggleActive(selected)}
                        className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 text-sm transition-colors"
                        title={selected.active ? "Deactivate" : "Activate"}
                      >
                        {selected.active ? "🔒" : "🔓"}
                      </button>
                      <button
                        onClick={() => deleteCust(selected)}
                        className="w-9 h-9 rounded-xl bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-500 text-sm transition-colors"
                        title="Delete customer"
                      >
                        🗑️
                      </button>
                    </>
                  )}
                </>
              )}
        </div>
      </div>

      {/* Outstanding balance card */}
      <div className={`rounded-2xl p-5 flex items-center justify-between ${selected.outstanding > 0 ? "bg-red-50 border-2 border-red-200" : "bg-green-50 border-2 border-green-200"}`}>
        <div>
          <p className="text-sm font-semibold text-slate-600">Outstanding Balance</p>
          <p className={`text-3xl font-black mt-0.5 ${selected.outstanding > 0 ? "text-red-600" : "text-green-600"}`}>
            {selected.outstanding > 0 ? `₹${selected.outstanding.toFixed(0)}` : "₹0 — Cleared ✓"}
          </p>
        </div>
        {selected.outstanding > 0 && (
          <div className="text-4xl">💸</div>
        )}
      </div>

      {/* Ledger */}
      {entriesLoading ? (
        <div className="text-center py-10 text-slate-400">Loading…</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <p className="text-3xl mb-2">📋</p>
          <p className="font-semibold">No entries yet</p>
          <p className="text-xs mt-1">Add a bill or payment to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((e, idx) => {
            const bal = runningBalance.find((r) => r.id === e.id)?.balance ?? 0;
            const isBill = e.type === "BILL";
            return (
              <div key={e.id} className={`bg-white border-l-4 rounded-2xl p-4 shadow-sm ${isBill ? "border-l-red-400" : "border-l-green-400"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isBill ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                        {isBill ? "BILL" : "PAYMENT"}
                      </span>
                      <span className="text-xs text-slate-400">{fmtDate(e.date)}</span>
                    </div>

                    {/* Bill items breakdown */}
                    {isBill && e.items && (e.items as BillItem[]).length > 0 && (
                      <div className="mt-2 space-y-0.5">
                        {(e.items as BillItem[]).map((item, i) => (
                          <p key={i} className="text-xs text-slate-600">
                            {item.name} ×{item.qty}
                            <span className="text-slate-400 ml-1">— ₹{(item.price * item.qty).toFixed(0)}</span>
                          </p>
                        ))}
                      </div>
                    )}

                    {e.description && <p className="text-xs text-slate-500 mt-1">{e.description}</p>}
                    {e.notes && <p className="text-xs text-slate-400 mt-0.5 italic">{e.notes}</p>}
                    <p className="text-xs text-slate-400 mt-1">Balance after: <span className={`font-semibold ${bal > 0 ? "text-red-600" : "text-green-600"}`}>₹{bal.toFixed(0)}</span></p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-lg font-black ${isBill ? "text-red-600" : "text-green-600"}`}>
                      {isBill ? "−" : "+"} ₹{e.amount.toFixed(0)}
                    </span>
                    {canDelete && (
                      <button
                        onClick={() => deleteEntry(e.id)}
                        className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-red-100 flex items-center justify-center text-slate-400 hover:text-red-500 text-xs transition-colors"
                        title="Delete entry"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit customer modal (in ledger view too) */}
      {showCustForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-black text-slate-800">Edit Customer</h3>
            <form onSubmit={saveCust} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Name *</label>
                <input type="text" value={custForm.name} onChange={(e) => setCustForm((p) => ({ ...p, name: e.target.value }))} required className={INPUT_CLS} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Phone</label>
                <input type="tel" value={custForm.phone} onChange={(e) => setCustForm((p) => ({ ...p, phone: e.target.value }))} className={INPUT_CLS} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Address</label>
                <input type="text" value={custForm.address} onChange={(e) => setCustForm((p) => ({ ...p, address: e.target.value }))} className={INPUT_CLS} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Notes</label>
                <input type="text" value={custForm.notes} onChange={(e) => setCustForm((p) => ({ ...p, notes: e.target.value }))} className={INPUT_CLS} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCustForm(false)} className="flex-1 border border-slate-300 text-slate-600 font-semibold py-2.5 rounded-xl text-sm">Cancel</button>
                <button type="submit" disabled={custSaving} className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white font-black py-2.5 rounded-xl text-sm transition-colors">
                  {custSaving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment modal */}
      {showPayment && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-lg font-black text-slate-800">💵 Record Payment</h3>
            <p className="text-sm text-slate-600">
              Outstanding: <span className="font-bold text-red-600">{fmtAmt(Math.max(0, selected.outstanding))}</span>
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Amount Paid (₹) *</label>
                <input
                  type="number"
                  min="1"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className={INPUT_CLS}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Date *</label>
                <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className={INPUT_CLS} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Notes</label>
                <input type="text" value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder="e.g. paid by UPI" className={INPUT_CLS} />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowPayment(false)} className="flex-1 border border-slate-300 text-slate-600 font-semibold py-2.5 rounded-xl text-sm">Cancel</button>
              <button
                onClick={savePayment}
                disabled={paySaving || !payAmount || parseFloat(payAmount) <= 0}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-black py-2.5 rounded-xl text-sm transition-colors"
              >
                {paySaving ? "Saving…" : "✅ Record Payment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Bill modal */}
      {showBill && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-lg flex flex-col max-h-[92dvh]">
            {/* Modal header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-800">➕ Add Bill for {selected.name}</h3>
              <button onClick={() => setShowBill(false)} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 font-bold">✕</button>
            </div>

            {/* Search menu */}
            <div className="p-4 border-b border-slate-100">
              <input
                ref={billSearchRef}
                type="text"
                value={billSearch}
                onChange={(e) => setBillSearch(e.target.value)}
                placeholder="Search menu items…"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </div>

            {/* Menu grid */}
            <div className="flex-1 overflow-y-auto p-4">
              {filteredMenu.length === 0 && billSearch && (
                <p className="text-center text-slate-400 py-6 text-sm">No items found</p>
              )}
              <div className="grid grid-cols-2 gap-2">
                {filteredMenu.map((item) => {
                  const inCart = cart.find((x) => x.name === item.name);
                  return (
                    <button
                      key={item.id}
                      onClick={() => addToCart(item)}
                      className={`text-left p-3 rounded-xl border-2 transition-colors ${
                        inCart ? "border-red-400 bg-red-50" : "border-slate-200 bg-white hover:border-red-200"
                      }`}
                    >
                      <p className="text-sm font-bold text-slate-800 leading-tight line-clamp-2">{item.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{item.category}</p>
                      <p className="text-sm font-black text-red-600 mt-1">₹{item.price}</p>
                      {inCart && (
                        <p className="text-xs font-bold text-red-500 mt-0.5">×{inCart.qty} in bill</p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cart section */}
            {cart.length > 0 && (
              <div className="border-t border-slate-200 p-4 space-y-3 bg-slate-50">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Bill Items</p>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {cart.map((item) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <p className="flex-1 text-sm text-slate-700 truncate">{item.name}</p>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setCartQty(item.name, item.qty - 1)}
                          className="w-6 h-6 rounded-lg bg-slate-200 hover:bg-red-200 text-slate-600 font-bold text-xs flex items-center justify-center"
                        >−</button>
                        <span className="w-6 text-center text-sm font-bold">{item.qty}</span>
                        <button
                          onClick={() => setCartQty(item.name, item.qty + 1)}
                          className="w-6 h-6 rounded-lg bg-slate-200 hover:bg-green-200 text-slate-600 font-bold text-xs flex items-center justify-center"
                        >＋</button>
                      </div>
                      <span className="text-sm font-bold text-slate-800 w-16 text-right">₹{(item.price * item.qty).toFixed(0)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                  <span className="font-bold text-slate-700">Total</span>
                  <span className="text-xl font-black text-red-600">₹{billTotal.toFixed(0)}</span>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 space-y-3">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Date</label>
                  <input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Notes</label>
                  <input type="text" value={billNotes} onChange={(e) => setBillNotes(e.target.value)} placeholder="Optional" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
                </div>
              </div>
              {billError && (
                <p className="text-xs text-red-600 font-semibold bg-red-50 rounded-lg px-3 py-2">{billError}</p>
              )}
              <button
                onClick={saveBill}
                disabled={billSaving || cart.length === 0}
                className="w-full bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white font-black py-3 rounded-xl text-sm transition-colors"
              >
                {billSaving ? "Saving…" : `Add Bill — ₹${billTotal.toFixed(0)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

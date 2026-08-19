"use client";

import { useEffect, useState, useCallback, useMemo } from "react";

interface AdvancePayment {
  id: string;
  partyType: string;
  customerName: string;
  phone?: string | null;
  amount: number;
  monthlySalary?: number | null;
  paymentMode: string;
  purpose?: string | null;
  date: string;
  receivedBy?: string | null;
  settled: boolean;
  settledOn?: string | null;
  createdAt: string;
}

interface StaffMember {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

const PAYMENT_MODES = ["Cash", "UPI", "Card", "Cheque", "Other"];

const INPUT_CLS =
  "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400";
const SELECT_CLS =
  "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400";

function fmt(d: string) {
  const [y, m, dd] = d.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${dd} ${months[parseInt(m) - 1]} ${y}`;
}

function todayStr() { return new Date().toISOString().slice(0, 10); }
function currentMonthStr() { return new Date().toISOString().slice(0, 7); }

const EMPTY_FORM = {
  partyType: "Customer",
  customerName: "",
  phone: "",
  amount: "",
  monthlySalary: "",
  paymentMode: "Cash",
  purpose: "",
  date: todayStr(),
  receivedBy: "",
};

export default function AdvanceManager() {
  const [advances, setAdvances] = useState<AdvancePayment[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(currentMonthStr());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "settled">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "Customer" | "Staff">("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [searchQ, setSearchQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/advance?month=${month}`);
      if (res.ok) setAdvances(await res.json());
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  // Fetch staff list once on mount
  useEffect(() => {
    fetch("/api/admin/staff")
      .then((r) => r.ok ? r.json() : [])
      .then((data: StaffMember[]) => setStaffList(data))
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customerName.trim() || !form.amount || !form.date) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        amount: parseFloat(form.amount),
        monthlySalary: form.monthlySalary ? parseFloat(form.monthlySalary) : null,
      };
      if (editId) {
        await fetch(`/api/advance/${editId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setEditId(null);
      } else {
        await fetch("/api/advance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      setForm(EMPTY_FORM);
      setShowForm(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function toggleSettle(a: AdvancePayment) {
    await fetch(`/api/advance/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settled: !a.settled, settledOn: !a.settled ? todayStr() : null }),
    });
    await load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this advance record?")) return;
    await fetch(`/api/advance/${id}`, { method: "DELETE" });
    await load();
  }

  function startEdit(a: AdvancePayment) {
    setEditId(a.id);
    setForm({
      partyType: a.partyType,
      customerName: a.customerName,
      phone: a.phone ?? "",
      amount: String(a.amount),
      monthlySalary: a.monthlySalary ? String(a.monthlySalary) : "",
      paymentMode: a.paymentMode,
      purpose: a.purpose ?? "",
      date: a.date,
      receivedBy: a.receivedBy ?? "",
    });
    setShowForm(true);
  }

  // Filtered list
  const filtered = useMemo(() => advances.filter((a) => {
    if (statusFilter === "pending" && a.settled) return false;
    if (statusFilter === "settled" && !a.settled) return false;
    if (typeFilter !== "all" && a.partyType !== typeFilter) return false;
    if (modeFilter !== "all" && a.paymentMode !== modeFilter) return false;
    if (searchQ.trim()) {
      const q = searchQ.toLowerCase();
      return (
        a.customerName.toLowerCase().includes(q) ||
        (a.phone ?? "").includes(q) ||
        (a.purpose ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  }), [advances, statusFilter, typeFilter, modeFilter, searchQ]);

  const totalAmount   = filtered.reduce((s, a) => s + a.amount, 0);
  const pendingAmount = filtered.filter((a) => !a.settled).reduce((s, a) => s + a.amount, 0);
  const settledAmount = filtered.filter((a) => a.settled).reduce((s, a) => s + a.amount, 0);
  const custTotal     = filtered.filter((a) => a.partyType === "Customer").reduce((s, a) => s + a.amount, 0);
  const staffTotal    = filtered.filter((a) => a.partyType === "Staff").reduce((s, a) => s + a.amount, 0);
  const cashTotal     = filtered.filter((a) => a.paymentMode === "Cash").reduce((s, a) => s + a.amount, 0);
  const upiTotal      = filtered.filter((a) => a.paymentMode === "UPI").reduce((s, a) => s + a.amount, 0);

  // Net payable calc (shown in form when salary entered)
  const advanceAmt   = parseFloat(form.amount) || 0;
  const salaryAmt    = parseFloat(form.monthlySalary) || 0;
  const netPayable   = salaryAmt > 0 ? salaryAmt - advanceAmt : null;

  function exportCSV() {
    const rows = [
      ["Date","Type","Name","Phone","Amount","Monthly Salary","Net Payable","Mode","Purpose","Received By","Settled","Settled On"],
      ...filtered.map((a) => {
        const net = a.monthlySalary ? a.monthlySalary - a.amount : "";
        return [
          a.date, a.partyType, a.customerName, a.phone ?? "", a.amount,
          a.monthlySalary ?? "", net,
          a.paymentMode, a.purpose ?? "", a.receivedBy ?? "",
          a.settled ? "Yes" : "No", a.settledOn ?? "",
        ];
      }),
    ];
    const csv  = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `advances-${month}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const isStaff = form.partyType === "Staff";

  return (
    <div className="max-w-5xl mx-auto py-6 px-4">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-800">💰 Advance Payments</h1>
          <p className="text-sm text-slate-500 mt-0.5">Track customer &amp; staff advances by month</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className={SELECT_CLS + " w-auto"}
          />
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition-colors"
          >
            📥 Export
          </button>
          <button
            onClick={() => { setEditId(null); setForm(EMPTY_FORM); setShowForm(true); }}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-semibold transition-colors shadow"
          >
            + Add Advance
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center col-span-2 sm:col-span-1">
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1">Total</p>
          <p className="text-2xl font-black text-amber-700">₹{totalAmount.toFixed(0)}</p>
          <p className="text-xs text-amber-400 mt-0.5">{filtered.length} records</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
          <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-1">Pending</p>
          <p className="text-xl font-black text-red-700">₹{pendingAmount.toFixed(0)}</p>
          <p className="text-xs text-red-400">{filtered.filter(a => !a.settled).length} records</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-1">Settled</p>
          <p className="text-xl font-black text-green-700">₹{settledAmount.toFixed(0)}</p>
          <p className="text-xs text-green-400">{filtered.filter(a => a.settled).length} records</p>
        </div>
        <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 text-center">
          <p className="text-xs font-semibold text-sky-600 uppercase tracking-wide mb-1">👤 Customers</p>
          <p className="text-xl font-black text-sky-700">₹{custTotal.toFixed(0)}</p>
          <p className="text-xs text-sky-400">{filtered.filter(a => a.partyType === "Customer").length} records</p>
        </div>
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 text-center">
          <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide mb-1">👔 Staff</p>
          <p className="text-xl font-black text-violet-700">₹{staffTotal.toFixed(0)}</p>
          <p className="text-xs text-violet-400">{filtered.filter(a => a.partyType === "Staff").length} records</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">💵 Cash / 📲 UPI</p>
          <p className="text-base font-black text-blue-700">₹{cashTotal.toFixed(0)}</p>
          <p className="text-xs text-blue-400">UPI: ₹{upiTotal.toFixed(0)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          type="search"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          placeholder="Search name, phone, purpose…"
          className={INPUT_CLS + " flex-1 min-w-[180px]"}
        />
        <div className="flex rounded-lg overflow-hidden border border-slate-200">
          {(["all", "Customer", "Staff"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-2 text-xs font-semibold transition-colors ${typeFilter === t ? "bg-amber-500 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              {t === "all" ? "All" : t === "Customer" ? "👤 Customers" : "👔 Staff"}
            </button>
          ))}
        </div>
        <div className="flex rounded-lg overflow-hidden border border-slate-200">
          {(["all", "pending", "settled"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-2 text-xs font-semibold capitalize transition-colors ${statusFilter === f ? "bg-amber-500 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              {f === "all" ? "All" : f === "pending" ? "⏳ Pending" : "✅ Settled"}
            </button>
          ))}
        </div>
        <select
          value={modeFilter}
          onChange={(e) => setModeFilter(e.target.value)}
          className={SELECT_CLS + " w-auto"}
        >
          <option value="all">All Modes</option>
          {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* Add / Edit Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 my-4"
          >
            <h2 className="text-lg font-black text-slate-800 mb-5">
              {editId ? "Edit Advance" : "Record New Advance"}
            </h2>

            {/* Party type toggle */}
            <div className="mb-5">
              <label className="block text-xs font-semibold text-slate-600 mb-2">Advance For *</label>
              <div className="flex gap-3">
                {(["Customer", "Staff"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm({ ...form, partyType: t, customerName: "" })}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 font-semibold text-sm transition-all ${
                      form.partyType === t
                        ? t === "Customer"
                          ? "border-sky-500 bg-sky-50 text-sky-700"
                          : "border-violet-500 bg-violet-50 text-violet-700"
                        : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    {t === "Customer" ? "👤" : "👔"} {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">

              {/* Name — dropdown for Staff, text for Customer */}
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  {isStaff ? "Staff Member *" : "Customer Name *"}
                </label>
                {isStaff ? (
                  <select
                    required
                    value={form.customerName}
                    onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                    className={SELECT_CLS}
                  >
                    <option value="">— Select staff member —</option>
                    {staffList.map((s) => (
                      <option key={s.id} value={s.name ?? s.email}>
                        {s.name ?? s.email} ({s.role.replace("_", " ")})
                      </option>
                    ))}
                    <option value="__other__">Other (enter manually)</option>
                  </select>
                ) : (
                  <input
                    required
                    value={form.customerName}
                    onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                    className={INPUT_CLS}
                    placeholder="e.g. Ramesh Kumar"
                  />
                )}
                {/* Manual entry fallback when "Other" is selected */}
                {isStaff && form.customerName === "__other__" && (
                  <input
                    required
                    className={INPUT_CLS + " mt-2"}
                    placeholder="Enter staff name manually"
                    onChange={(e) => setForm({ ...form, customerName: e.target.value === "" ? "__other__" : e.target.value })}
                  />
                )}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Phone</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className={INPUT_CLS}
                  placeholder="10-digit"
                  maxLength={10}
                />
              </div>

              {/* Advance Amount */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Advance Amount (₹) *</label>
                <input
                  required
                  type="number"
                  min="1"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className={INPUT_CLS}
                  placeholder="e.g. 500"
                />
              </div>

              {/* Monthly Salary — only for Staff */}
              {isStaff && (
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Monthly Salary (₹) <span className="text-slate-400 font-normal">— optional, for net payable calc</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.monthlySalary}
                    onChange={(e) => setForm({ ...form, monthlySalary: e.target.value })}
                    className={INPUT_CLS}
                    placeholder="e.g. 12000"
                  />
                  {/* Live calculation */}
                  {netPayable !== null && (
                    <div className={`mt-2 flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold ${
                      netPayable >= 0
                        ? "bg-green-50 border border-green-200 text-green-700"
                        : "bg-red-50 border border-red-200 text-red-700"
                    }`}>
                      <span>Salary ₹{salaryAmt.toFixed(0)}</span>
                      <span className="text-slate-400">−</span>
                      <span>Advance ₹{advanceAmt.toFixed(0)}</span>
                      <span className="text-slate-400">=</span>
                      <span className="font-black text-lg">
                        Net Payable: ₹{netPayable.toFixed(0)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Payment Mode */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Payment Mode *</label>
                <select
                  value={form.paymentMode}
                  onChange={(e) => setForm({ ...form, paymentMode: e.target.value })}
                  className={SELECT_CLS}
                >
                  {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Date *</label>
                <input
                  required
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className={INPUT_CLS}
                />
              </div>

              {/* Received By */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Received By</label>
                <input
                  value={form.receivedBy}
                  onChange={(e) => setForm({ ...form, receivedBy: e.target.value })}
                  className={INPUT_CLS}
                  placeholder="Admin / manager name"
                />
              </div>

              {/* Purpose */}
              <div className={isStaff ? "col-span-1" : "col-span-2"}>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Purpose / Notes</label>
                <textarea
                  value={form.purpose}
                  onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                  rows={2}
                  className={INPUT_CLS + " resize-none"}
                  placeholder={isStaff ? "e.g. Salary advance, emergency loan…" : "e.g. Event booking, catering deposit…"}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold py-2.5 rounded-lg transition-colors"
              >
                {saving ? "Saving…" : editId ? "Update" : "Save Advance"}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditId(null); setForm(EMPTY_FORM); }}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="text-center py-16 text-slate-400">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-4xl mb-3">💸</p>
          <p className="font-semibold text-slate-500">No advance records for this period</p>
          <p className="text-sm">Click &ldquo;+ Add Advance&rdquo; to record one</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Date</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Type</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Name</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Phone</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Advance</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Salary</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Net Pay</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Mode</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Purpose</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((a) => {
                const net = a.monthlySalary ? a.monthlySalary - a.amount : null;
                return (
                  <tr key={a.id} className={`hover:bg-slate-50 transition-colors ${a.settled ? "opacity-60" : ""}`}>
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{fmt(a.date)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                        a.partyType === "Staff" ? "bg-violet-100 text-violet-700" : "bg-sky-100 text-sky-700"
                      }`}>
                        {a.partyType === "Staff" ? "👔" : "👤"} {a.partyType}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{a.customerName}</td>
                    <td className="px-4 py-3 text-slate-500">{a.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800">₹{a.amount.toFixed(0)}</td>
                    <td className="px-4 py-3 text-right text-slate-500">
                      {a.monthlySalary ? `₹${a.monthlySalary.toFixed(0)}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {net !== null ? (
                        <span className={`font-bold ${net >= 0 ? "text-green-700" : "text-red-600"}`}>
                          ₹{net.toFixed(0)}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                        a.paymentMode === "Cash"   ? "bg-blue-100 text-blue-700"
                        : a.paymentMode === "UPI"  ? "bg-purple-100 text-purple-700"
                        : a.paymentMode === "Card" ? "bg-green-100 text-green-700"
                        : "bg-slate-100 text-slate-600"
                      }`}>
                        {a.paymentMode === "Cash" ? "💵" : a.paymentMode === "UPI" ? "📲" : a.paymentMode === "Card" ? "💳" : "📄"} {a.paymentMode}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 max-w-[160px] truncate">{a.purpose ?? "—"}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleSettle(a)}
                        title={a.settled ? `Settled on ${a.settledOn ?? ""}` : "Mark as settled"}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                          a.settled
                            ? "bg-green-100 text-green-700 hover:bg-green-200"
                            : "bg-red-100 text-red-700 hover:bg-red-200"
                        }`}
                      >
                        {a.settled ? "✅ Settled" : "⏳ Pending"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => startEdit(a)} className="text-slate-400 hover:text-amber-600 transition-colors" title="Edit">✏️</button>
                        <button onClick={() => handleDelete(a.id)} className="text-slate-400 hover:text-red-600 transition-colors" title="Delete">🗑️</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-50 border-t-2 border-slate-200">
              <tr>
                <td colSpan={4} className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">
                  Total ({filtered.length} records)
                </td>
                <td className="px-4 py-3 text-right font-black text-slate-800">₹{totalAmount.toFixed(0)}</td>
                <td colSpan={6} className="px-4 py-3 text-xs text-slate-500 space-x-3">
                  <span>👤 Customers: <span className="font-bold text-sky-700">₹{custTotal.toFixed(0)}</span></span>
                  <span>·</span>
                  <span>👔 Staff: <span className="font-bold text-violet-700">₹{staffTotal.toFixed(0)}</span></span>
                  <span>·</span>
                  <span>Pending: <span className="font-bold text-red-600">₹{pendingAmount.toFixed(0)}</span></span>
                  <span>·</span>
                  <span>Settled: <span className="font-bold text-green-600">₹{settledAmount.toFixed(0)}</span></span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

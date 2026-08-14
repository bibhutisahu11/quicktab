"use client";

import { useEffect, useState, useCallback } from "react";

type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "HALF_DAY" | "ON_LEAVE";

interface StaffMember {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

interface AttendanceRecord {
  id: string;
  adminId: string;
  date: string;
  status: AttendanceStatus;
  checkIn: string | null;
  checkOut: string | null;
  notes: string | null;
}

const STATUS_CONFIG: Record<AttendanceStatus, { label: string; color: string; bg: string; border: string; emoji: string }> = {
  PRESENT:  { label: "Present",   color: "text-green-700",  bg: "bg-green-100",  border: "border-green-400",  emoji: "✅" },
  ABSENT:   { label: "Absent",    color: "text-red-700",    bg: "bg-red-100",    border: "border-red-400",    emoji: "❌" },
  LATE:     { label: "Late",      color: "text-yellow-700", bg: "bg-yellow-100", border: "border-yellow-400", emoji: "⏰" },
  HALF_DAY: { label: "Half Day",  color: "text-orange-700", bg: "bg-orange-100", border: "border-orange-400", emoji: "🌓" },
  ON_LEAVE: { label: "On Leave",  color: "text-purple-700", bg: "bg-purple-100", border: "border-purple-400", emoji: "🏖️" },
};

const ROLE_LABELS: Record<string, string> = {
  HOTEL_ADMIN: "Admin",
  MANAGER: "Manager",
  WAITER: "Waiter",
  KITCHEN: "Kitchen",
  BILLER: "Biller",
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonthStr() {
  return new Date().toISOString().slice(0, 7);
}

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

function getDaysInMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const days = new Date(y, m, 0).getDate();
  return Array.from({ length: days }, (_, i) => {
    const dd = String(i + 1).padStart(2, "0");
    return `${ym}-${dd}`;
  });
}

export default function AttendanceManager() {
  const [tab, setTab] = useState<"today" | "history" | "monthly">("today");
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Today tab
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [savingId, setSavingId] = useState<string | null>(null);

  // Edit modal
  const [editModal, setEditModal] = useState<{ staffId: string; date: string } | null>(null);
  const [editStatus, setEditStatus] = useState<AttendanceStatus>("PRESENT");
  const [editCheckIn, setEditCheckIn] = useState("");
  const [editCheckOut, setEditCheckOut] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Monthly tab
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr());

  const fetchData = useCallback(async (date?: string, month?: string) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (month) params.set("month", month);
    else params.set("date", date ?? selectedDate);
    const res = await fetch(`/api/attendance?${params}`);
    if (res.ok) {
      const data = await res.json();
      setStaff(data.staff ?? []);
      setRecords(data.records ?? []);
    }
    setLoading(false);
  }, [selectedDate]);

  useEffect(() => {
    if (tab === "monthly") fetchData(undefined, selectedMonth);
    else fetchData(selectedDate);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, selectedDate, selectedMonth]);

  function getRecord(staffId: string, date?: string) {
    return records.find((r) => r.adminId === staffId && r.date === (date ?? selectedDate));
  }

  async function quickMark(staffId: string, status: AttendanceStatus) {
    setSavingId(staffId);
    const existing = getRecord(staffId);
    await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminId: staffId, date: selectedDate, status,
        checkIn: existing?.checkIn, checkOut: existing?.checkOut, notes: existing?.notes }),
    });
    await fetchData(selectedDate);
    setSavingId(null);
  }

  function openEdit(staffId: string) {
    const rec = getRecord(staffId);
    setEditModal({ staffId, date: selectedDate });
    setEditStatus(rec?.status ?? "PRESENT");
    setEditCheckIn(rec?.checkIn ?? "");
    setEditCheckOut(rec?.checkOut ?? "");
    setEditNotes(rec?.notes ?? "");
  }

  async function saveEdit() {
    if (!editModal) return;
    setSaving(true);
    await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        adminId: editModal.staffId, date: editModal.date,
        status: editStatus, checkIn: editCheckIn, checkOut: editCheckOut, notes: editNotes,
      }),
    });
    await fetchData(selectedDate);
    setSaving(false);
    setEditModal(null);
  }

  // ── Summary helpers ─────────────────────────────────────────────────────────
  function getMonthlySummary(staffId: string) {
    const days = getDaysInMonth(selectedMonth);
    const staffRecords = records.filter((r) => r.adminId === staffId);
    const counts = { PRESENT: 0, ABSENT: 0, LATE: 0, HALF_DAY: 0, ON_LEAVE: 0, UNMARKED: 0 };
    for (const day of days) {
      const rec = staffRecords.find((r) => r.date === day);
      if (rec) counts[rec.status]++;
      else counts.UNMARKED++;
    }
    return { counts, total: days.length };
  }

  // ── CSV export ──────────────────────────────────────────────────────────────
  function exportCSV() {
    const days = tab === "monthly" ? getDaysInMonth(selectedMonth) : [selectedDate];
    const rows: string[][] = [
      ["Name", "Email", "Role", ...days.map(formatDate), "Present", "Absent", "Late", "Half Day", "Leave"],
    ];
    for (const s of staff) {
      const row: string[] = [s.name ?? s.email, s.email, ROLE_LABELS[s.role] ?? s.role];
      let p = 0, a = 0, l = 0, h = 0, o = 0;
      for (const day of days) {
        const rec = records.find((r) => r.adminId === s.id && r.date === day);
        const st = rec?.status ?? "—";
        row.push(st === "PRESENT" ? "P" : st === "ABSENT" ? "A" : st === "LATE" ? "L" : st === "HALF_DAY" ? "H" : st === "ON_LEAVE" ? "OL" : "—");
        if (st === "PRESENT") p++; else if (st === "ABSENT") a++;
        else if (st === "LATE") l++; else if (st === "HALF_DAY") h++; else if (st === "ON_LEAVE") o++;
      }
      row.push(String(p), String(a), String(l), String(h), String(o));
      rows.push(row);
    }
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${tab === "monthly" ? selectedMonth : selectedDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Today summary bar ───────────────────────────────────────────────────────
  const summary = {
    present:  records.filter((r) => r.date === selectedDate && r.status === "PRESENT").length,
    absent:   records.filter((r) => r.date === selectedDate && r.status === "ABSENT").length,
    late:     records.filter((r) => r.date === selectedDate && r.status === "LATE").length,
    halfDay:  records.filter((r) => r.date === selectedDate && r.status === "HALF_DAY").length,
    onLeave:  records.filter((r) => r.date === selectedDate && r.status === "ON_LEAVE").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Attendance Management</h2>
          <p className="text-slate-500 text-sm mt-0.5">Track daily staff attendance, check-in/out times & monthly reports</p>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-colors"
        >
          ⬇️ Export CSV
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {(["today", "history", "monthly"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${
              tab === t ? "bg-white text-slate-800 shadow" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t === "today" ? "📅 Today" : t === "history" ? "🗓️ History" : "📊 Monthly"}
          </button>
        ))}
      </div>

      {/* Date picker for Today/History */}
      {tab !== "monthly" && (
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="date"
            value={selectedDate}
            max={todayStr()}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border border-slate-300 rounded-xl px-3 py-2 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <p className="text-slate-500 text-sm">{formatDate(selectedDate)}</p>
          {selectedDate !== todayStr() && (
            <button onClick={() => setSelectedDate(todayStr())} className="text-amber-600 text-xs font-bold hover:underline">Jump to Today</button>
          )}
        </div>
      )}

      {/* Month picker */}
      {tab === "monthly" && (
        <input
          type="month"
          value={selectedMonth}
          max={currentMonthStr()}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="border border-slate-300 rounded-xl px-3 py-2 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
      )}

      {/* Summary bar (Today / History tabs) */}
      {tab !== "monthly" && staff.length > 0 && (
        <div className="grid grid-cols-5 gap-2">
          {([
            { key: "PRESENT"  as AttendanceStatus, value: summary.present },
            { key: "ABSENT"   as AttendanceStatus, value: summary.absent },
            { key: "LATE"     as AttendanceStatus, value: summary.late },
            { key: "HALF_DAY" as AttendanceStatus, value: summary.halfDay },
            { key: "ON_LEAVE" as AttendanceStatus, value: summary.onLeave },
          ]).map(({ key, value }) => {
            const cfg = STATUS_CONFIG[key];
            return (
              <div key={key} className={`${cfg.bg} ${cfg.border} border rounded-xl px-3 py-3 text-center`}>
                <p className="text-2xl font-black text-slate-800">{value}</p>
                <p className={`text-xs font-semibold ${cfg.color}`}>{cfg.emoji} {cfg.label}</p>
              </div>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-slate-400">
          <div className="text-4xl animate-pulse mb-3">📋</div>
          <p>Loading attendance data...</p>
        </div>
      ) : staff.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 rounded-2xl text-slate-400">
          <div className="text-4xl mb-3">👤</div>
          <p className="font-semibold">No staff found</p>
          <p className="text-sm mt-1">Add staff members from the Users section first</p>
        </div>
      ) : tab === "monthly" ? (
        /* ── Monthly view ─────────────────────────────────────────────── */
        <div className="space-y-4">
          {staff.map((s) => {
            const { counts, total } = getMonthlySummary(s.id);
            const workDays = counts.PRESENT + counts.LATE + counts.HALF_DAY;
            const pct = Math.round((workDays / total) * 100);
            return (
              <div key={s.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                {/* Staff header */}
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center font-black text-amber-700 text-lg">
                      {(s.name ?? s.email)[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{s.name ?? s.email}</p>
                      <p className="text-xs text-slate-500">{ROLE_LABELS[s.role] ?? s.role}</p>
                    </div>
                  </div>
                  {/* Attendance % pill */}
                  <div className={`px-3 py-1.5 rounded-full text-sm font-black ${
                    pct >= 90 ? "bg-green-100 text-green-700" : pct >= 70 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"
                  }`}>
                    {pct}% Attendance
                  </div>
                </div>

                {/* Stat chips */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {Object.entries(counts).filter(([k]) => k !== "UNMARKED" && counts[k as keyof typeof counts] > 0).map(([status, count]) => {
                    const cfg = STATUS_CONFIG[status as AttendanceStatus];
                    return (
                      <span key={status} className={`${cfg.bg} ${cfg.color} px-2.5 py-1 rounded-full text-xs font-bold`}>
                        {cfg.emoji} {cfg.label}: {count}
                      </span>
                    );
                  })}
                  {counts.UNMARKED > 0 && (
                    <span className="bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full text-xs font-bold">
                      — Unmarked: {counts.UNMARKED}
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                <div className="bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all ${pct >= 90 ? "bg-green-500" : pct >= 70 ? "bg-yellow-500" : "bg-red-500"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">{workDays} of {total} working days</p>

                {/* Day-by-day calendar strip */}
                <div className="mt-4 flex flex-wrap gap-1">
                  {getDaysInMonth(selectedMonth).map((day) => {
                    const rec = records.find((r) => r.adminId === s.id && r.date === day);
                    const cfg = rec ? STATUS_CONFIG[rec.status] : null;
                    const dayNum = parseInt(day.slice(-2));
                    return (
                      <div
                        key={day}
                        title={`${formatDate(day)}: ${cfg?.label ?? "Unmarked"}`}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold border ${
                          cfg ? `${cfg.bg} ${cfg.border} ${cfg.color}` : "bg-slate-50 border-slate-200 text-slate-300"
                        }`}
                      >
                        {dayNum}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── Today / History view ────────────────────────────────────── */
        <div className="space-y-3">
          {/* Mark All buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-500 font-semibold">Mark all:</span>
            {(["PRESENT", "ABSENT"] as AttendanceStatus[]).map((st) => {
              const cfg = STATUS_CONFIG[st];
              return (
                <button
                  key={st}
                  onClick={async () => {
                    for (const s of staff) await quickMark(s.id, st);
                  }}
                  className={`${cfg.bg} ${cfg.color} ${cfg.border} border px-3 py-1 rounded-full text-xs font-bold transition-colors`}
                >
                  {cfg.emoji} All {cfg.label}
                </button>
              );
            })}
          </div>

          {staff.map((s) => {
            const rec = getRecord(s.id);
            const status = rec?.status;
            const cfg = status ? STATUS_CONFIG[status] : null;
            const isLoading = savingId === s.id;

            return (
              <div key={s.id} className={`bg-white border-2 rounded-2xl p-4 shadow-sm transition-all ${cfg ? cfg.border : "border-slate-200"}`}>
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Avatar */}
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center font-black text-lg flex-shrink-0 ${cfg ? cfg.bg : "bg-slate-100"} ${cfg?.color ?? "text-slate-400"}`}>
                    {(s.name ?? s.email)[0].toUpperCase()}
                  </div>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 text-sm">{s.name ?? s.email}</p>
                    <p className="text-xs text-slate-500">{ROLE_LABELS[s.role] ?? s.role}</p>
                    {rec?.checkIn && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        In: <span className="font-semibold text-slate-600">{rec.checkIn}</span>
                        {rec.checkOut && <> · Out: <span className="font-semibold text-slate-600">{rec.checkOut}</span></>}
                      </p>
                    )}
                    {rec?.notes && <p className="text-xs text-slate-400 mt-0.5 italic">{rec.notes}</p>}
                  </div>

                  {/* Current status badge */}
                  {cfg && (
                    <span className={`${cfg.bg} ${cfg.color} px-2.5 py-1 rounded-full text-xs font-bold flex-shrink-0`}>
                      {cfg.emoji} {cfg.label}
                    </span>
                  )}

                  {/* Quick status buttons */}
                  <div className="flex flex-wrap gap-1.5 flex-shrink-0">
                    {(Object.keys(STATUS_CONFIG) as AttendanceStatus[]).map((st) => {
                      const c = STATUS_CONFIG[st];
                      const isActive = status === st;
                      return (
                        <button
                          key={st}
                          disabled={isLoading}
                          onClick={() => quickMark(s.id, st)}
                          title={c.label}
                          className={`px-2 py-1 rounded-lg text-xs font-bold border transition-all ${
                            isActive
                              ? `${c.bg} ${c.color} ${c.border} shadow-sm`
                              : "bg-white text-slate-400 border-slate-200 hover:border-slate-400"
                          }`}
                        >
                          {isLoading && isActive ? "…" : c.emoji}
                        </button>
                      );
                    })}
                    {/* Edit details button */}
                    <button
                      onClick={() => openEdit(s.id)}
                      title="Add check-in/out time & notes"
                      className="px-2 py-1 rounded-lg text-xs border border-slate-200 hover:border-amber-400 text-slate-400 hover:text-amber-600 transition-all"
                    >
                      ✏️
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit modal */}
      {editModal && (() => {
        const s = staff.find((x) => x.id === editModal.staffId);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setEditModal(null)}>
            <div className="absolute inset-0 bg-black/40" />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="font-black text-slate-800 text-lg mb-1">Edit Attendance</h3>
              <p className="text-slate-500 text-sm mb-5">{s?.name ?? s?.email} · {formatDate(editModal.date)}</p>

              {/* Status */}
              <div className="mb-4">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Status</p>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(STATUS_CONFIG) as AttendanceStatus[]).map((st) => {
                    const cfg = STATUS_CONFIG[st];
                    return (
                      <button
                        key={st}
                        onClick={() => setEditStatus(st)}
                        className={`py-2 rounded-xl border-2 text-xs font-bold transition-all ${
                          editStatus === st ? `${cfg.bg} ${cfg.color} ${cfg.border}` : "border-slate-200 text-slate-400"
                        }`}
                      >
                        {cfg.emoji} {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Times */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Check-in</label>
                  <input type="time" value={editCheckIn} onChange={(e) => setEditCheckIn(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Check-out</label>
                  <input type="time" value={editCheckOut} onChange={(e) => setEditCheckOut(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
              </div>

              {/* Notes */}
              <div className="mb-5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Notes (optional)</label>
                <input type="text" value={editNotes} onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="e.g. Doctor appointment, early leave..."
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>

              <div className="flex gap-3">
                <button onClick={() => setEditModal(null)} className="flex-1 border border-slate-300 text-slate-600 font-semibold py-2.5 rounded-xl text-sm">Cancel</button>
                <button onClick={saveEdit} disabled={saving}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-black py-2.5 rounded-xl text-sm transition-colors">
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { TableData } from "@/types";

export default function TableManager() {
  const [tables, setTables] = useState<TableData[]>([]);
  const [orgSlug, setOrgSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newCapacity, setNewCapacity] = useState("4");
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState("");

  useEffect(() => {
    setBaseUrl(window.location.origin);
    fetchTables();
  }, []);

  async function fetchTables() {
    const res = await fetch("/api/admin/tables");
    if (res.ok) {
      const data = await res.json();
      setTables(data.tables ?? data);
      if (data.orgSlug) setOrgSlug(data.orgSlug);
    }
    setLoading(false);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    const res = await fetch("/api/tables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), capacity: parseInt(newCapacity) }),
    });
    if (res.ok) {
      const table = await res.json();
      setTables((prev) => [...prev, table]);
      setNewName("");
      setNewCapacity("4");
    }
    setAdding(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this table? This cannot be undone.")) return;
    setDeletingId(id);
    const res = await fetch(`/api/tables/${id}`, { method: "DELETE" });
    if (res.ok) setTables((prev) => prev.filter((t) => t.id !== id));
    setDeletingId(null);
  }

  async function toggleActive(table: TableData) {
    const res = await fetch(`/api/tables/${table.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !table.active }),
    });
    if (res.ok) {
      const updated = await res.json();
      setTables((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    }
  }

  async function downloadQR(table: TableData) {
    setQrLoading(table.id);
    try {
      const res = await fetch(`/api/tables/${table.id}/qr`);
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        alert(`Failed to generate QR code. ${errText || res.statusText}`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${table.name.replace(/\s+/g, "-")}-qr.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Error downloading QR: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setQrLoading(null);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Tables & QR Codes</h1>
        <p className="text-slate-500 text-sm">Generate QR codes for each table and download as PNG</p>
      </div>

      {/* Parcel link */}
      <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-bold text-orange-800 flex items-center gap-2">
              <span>📦</span> Parcel / Takeaway Order Link
            </h2>
            <p className="text-orange-600 text-sm mt-1">
              Share this URL for walk-in parcel orders (no QR needed)
            </p>
            <code className="block mt-2 text-sm bg-white border border-orange-200 rounded-lg px-3 py-2 text-slate-700 break-all">
              {baseUrl}/{orgSlug}/menu/parcel
            </code>
          </div>
          <button
            onClick={() => navigator.clipboard.writeText(`${baseUrl}/${orgSlug}/menu/parcel`)}
            className="flex-shrink-0 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Copy Link
          </button>
        </div>
      </div>

      {/* Add table form */}
      <form
        onSubmit={handleAdd}
        className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-6"
      >
        <h2 className="font-semibold text-slate-700 mb-4">Add New Table</h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Table name, e.g. Table 1 or VIP Room"
            className="flex-1 border border-slate-300 rounded-lg px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
            required
          />
          <input
            type="number"
            value={newCapacity}
            onChange={(e) => setNewCapacity(e.target.value)}
            min="1"
            max="20"
            placeholder="Seats"
            className="w-20 border border-slate-300 rounded-lg px-3 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 text-center"
          />
          <button
            type="submit"
            disabled={adding}
            className="bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            {adding ? "Adding..." : "+ Add"}
          </button>
        </div>
      </form>

      {loading ? (
        <div className="text-center py-20 text-slate-400">
          <div className="text-5xl animate-pulse mb-3">📱</div>
          <p>Loading tables...</p>
        </div>
      ) : tables.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <div className="text-5xl mb-3">🪑</div>
          <p className="text-lg">No tables yet</p>
          <p className="text-sm mt-1">Add your first table above</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {tables.map((table) => (
            <div
              key={table.id}
              className={`bg-white rounded-2xl shadow-sm border p-5 ${
                table.active ? "border-slate-100" : "border-slate-200 opacity-60"
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">{table.name}</h3>
                  <p className="text-slate-500 text-sm">
                    {table.capacity} seats ·{" "}
                    <span className={table.active ? "text-green-600" : "text-red-500"}>
                      {table.active ? "Active" : "Inactive"}
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => toggleActive(table)}
                  className={`text-xs font-bold px-3 py-1 rounded-full transition-colors ${
                    table.active
                      ? "bg-green-100 text-green-700 hover:bg-green-200"
                      : "bg-red-100 text-red-600 hover:bg-red-200"
                  }`}
                >
                  {table.active ? "Active" : "Inactive"}
                </button>
              </div>

              <div className="bg-slate-50 rounded-xl p-3 mb-4">
                <p className="text-xs text-slate-500 mb-1">Order URL:</p>
                <code className="text-xs text-slate-700 break-all">
                  {baseUrl}/{orgSlug}/menu/{table.qrToken}
                </code>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => downloadQR(table)}
                  disabled={qrLoading === table.id}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {qrLoading === table.id ? (
                    "Generating..."
                  ) : (
                    <>
                      <span>📥</span> Download QR
                    </>
                  )}
                </button>
                <button
                  onClick={() => navigator.clipboard.writeText(`${baseUrl}/${orgSlug}/menu/${table.qrToken}`)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2.5 px-3 rounded-xl text-sm transition-colors"
                  title="Copy link"
                >
                  🔗
                </button>
                <button
                  onClick={() => handleDelete(table.id)}
                  disabled={deletingId === table.id}
                  className="bg-red-50 hover:bg-red-100 text-red-500 font-medium py-2.5 px-3 rounded-xl text-sm transition-colors disabled:opacity-50"
                  title="Delete table"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

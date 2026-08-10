"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { MenuItemData } from "@/types";
import MenuScanner from "./MenuScanner";

const EMPTY_FORM = {
  name: "",
  description: "",
  price: "",
  category: "",
  imageUrl: "",
  available: true,
  sortOrder: "0",
};

export default function MenuManager() {
  const { data: session } = useSession();
  const isBiller = session?.user?.role === "BILLER";

  const [items, setItems] = useState<MenuItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<MenuItemData | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  // BILLER lands directly on availability tab and cannot switch to manage
  const [tab, setTab] = useState<"manage" | "availability">("manage");
  const [pendingAvail, setPendingAvail] = useState<Record<string, boolean>>({});
  const [savingAvail, setSavingAvail] = useState(false);

  // Force BILLER to availability tab
  useEffect(() => {
    if (isBiller) setTab("availability");
  }, [isBiller]);

  async function fetchItems() {
    const res = await fetch("/api/menu");
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }

  useEffect(() => { fetchItems(); }, []);

  function openCreate() {
    setEditItem(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEdit(item: MenuItemData) {
    setEditItem(item);
    setForm({
      name: item.name,
      description: item.description ?? "",
      price: String(item.price),
      category: item.category,
      imageUrl: item.imageUrl ?? "",
      available: item.available,
      sortOrder: String(item.sortOrder),
    });
    setFormOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        price: parseFloat(form.price),
        category: form.category,
        imageUrl: form.imageUrl || null,
        available: form.available,
        sortOrder: parseInt(form.sortOrder),
      };

      if (editItem) {
        const res = await fetch(`/api/menu/${editItem.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const updated = await res.json();
          setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
        }
      } else {
        const res = await fetch("/api/menu", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const created = await res.json();
          setItems((prev) => [...prev, created]);
        }
      }
      setFormOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this menu item? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/menu/${id}`, { method: "DELETE" });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== id));
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Failed to delete item. Please try again.");
      }
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  async function toggleAvailable(item: MenuItemData) {
    // Optimistic update
    const newVal = !item.available;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, available: newVal } : i)));
    try {
      const res = await fetch(`/api/menu/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ available: newVal }),
      });
      if (!res.ok) {
        // Revert on failure
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, available: item.available } : i)));
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Failed to update availability.");
      }
    } catch {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, available: item.available } : i)));
      alert("Network error. Please try again.");
    }
  }

  const categories = Array.from(new Set(items.map((i) => i.category))).sort();
  const filtered = items.filter(
    (i) =>
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.category.toLowerCase().includes(search.toLowerCase())
  );

  const grouped = categories.reduce(
    (acc, cat) => {
      const catItems = filtered.filter((i) => i.category === cat);
      if (catItems.length) acc[cat] = catItems;
      return acc;
    },
    {} as Record<string, MenuItemData[]>
  );

  // Include items not matching existing categories (new ones)
  const uncategorized = filtered.filter((i) => !categories.includes(i.category));
  if (uncategorized.length) grouped["Other"] = uncategorized;

  // -- Availability tab helpers --
  function getAvail(item: MenuItemData) {
    return pendingAvail[item.id] !== undefined ? pendingAvail[item.id] : item.available;
  }

  function togglePending(id: string, val: boolean) {
    setPendingAvail((prev) => ({ ...prev, [id]: val }));
  }

  function setCategoryAvail(cat: string, val: boolean) {
    const ids = items.filter((i) => i.category === cat).map((i) => i.id);
    setPendingAvail((prev) => {
      const next = { ...prev };
      ids.forEach((id) => { next[id] = val; });
      return next;
    });
  }

  function setAllAvail(val: boolean) {
    const next: Record<string, boolean> = {};
    items.forEach((i) => { next[i.id] = val; });
    setPendingAvail(next);
  }

  async function saveAvailability() {
    const updates = Object.entries(pendingAvail).map(([id, available]) => ({ id, available }));
    if (updates.length === 0) return;
    setSavingAvail(true);
    try {
      const res = await fetch("/api/menu", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      if (res.ok) {
        setItems((prev) =>
          prev.map((i) => pendingAvail[i.id] !== undefined ? { ...i, available: pendingAvail[i.id] } : i)
        );
        setPendingAvail({});
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Failed to save availability. Please try again.");
      }
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setSavingAvail(false);
    }
  }

  // ── Category rename state ────────────────────────────────────────────────
  const [editingCat, setEditingCat]   = useState<string | null>(null);
  const [catDraft, setCatDraft]       = useState("");
  const [renamingCat, setRenamingCat] = useState(false);
  const catInputRef = useRef<HTMLInputElement>(null);

  async function renameCategory(oldName: string, newName: string) {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) { setEditingCat(null); return; }
    setRenamingCat(true);
    try {
      const res = await fetch("/api/menu/rename-category", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldName, newName: trimmed }),
      });
      if (res.ok) {
        setItems((prev) => prev.map((i) => i.category === oldName ? { ...i, category: trimmed } : i));
      } else {
        const d = await res.json().catch(() => ({}));
        alert(d.error ?? "Failed to rename category.");
      }
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setRenamingCat(false);
      setEditingCat(null);
    }
  }

  const availChanged = Object.keys(pendingAvail).length > 0;
  const availByCategory = categories.reduce((acc, cat) => {
    acc[cat] = items.filter((i) => i.category === cat);
    return acc;
  }, {} as Record<string, MenuItemData[]>);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            {isBiller ? "Menu Availability" : "Menu Management"}
          </h1>
          <p className="text-slate-500 text-sm">
            {items.filter((i) => i.available).length} available · {items.filter((i) => !i.available).length} unavailable
          </p>
        </div>
        {!isBiller && (
          <div className="flex gap-2">
            <button
              onClick={() => setScannerOpen(true)}
              className="bg-violet-500 hover:bg-violet-600 text-white font-semibold px-4 py-2.5 rounded-xl transition-colors flex items-center gap-2"
            >
              📷 Scan Menu
            </button>
            <button
              onClick={openCreate}
              className="bg-amber-500 hover:bg-amber-600 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors flex items-center gap-2"
            >
              + Add Item
            </button>
          </div>
        )}
      </div>

      {/* Tabs — hidden for BILLER (they only see availability) */}
      {!isBiller && (
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-5 w-fit">
          {(["manage", "availability"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === t ? "bg-white shadow text-slate-800" : "text-slate-500 hover:text-slate-700"}`}>
              {t === "manage" ? "🍴 Manage Items" : "🔄 Quick Availability"}
            </button>
          ))}
        </div>
      )}

      {tab === "availability" && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex gap-2">
              <button onClick={() => setAllAvail(true)} className="bg-green-100 hover:bg-green-200 text-green-700 font-semibold px-4 py-2 rounded-xl text-sm transition-colors">
                ✅ All Available
              </button>
              <button onClick={() => setAllAvail(false)} className="bg-red-100 hover:bg-red-200 text-red-700 font-semibold px-4 py-2 rounded-xl text-sm transition-colors">
                ❌ All Unavailable
              </button>
            </div>
            <button onClick={saveAvailability} disabled={!availChanged || savingAvail}
              className="bg-amber-500 hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold px-6 py-2 rounded-xl text-sm transition-colors">
              {savingAvail ? "Saving…" : `Save Changes${availChanged ? ` (${Object.keys(pendingAvail).length})` : ""}`}
            </button>
          </div>

          {availChanged && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
              <span>⚠️</span> You have {Object.keys(pendingAvail).length} unsaved change{Object.keys(pendingAvail).length !== 1 ? "s" : ""}. Click <strong>Save Changes</strong> to apply.
            </div>
          )}

          {Object.entries(availByCategory).map(([cat, catItems]) => (
            <div key={cat} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="bg-slate-50 border-b border-slate-100 px-5 py-3 flex items-center justify-between">
                {editingCat === cat ? (
                  <form className="flex items-center gap-2"
                    onSubmit={(e) => { e.preventDefault(); renameCategory(cat, catDraft); }}>
                    <input
                      ref={catInputRef}
                      value={catDraft}
                      onChange={(e) => setCatDraft(e.target.value)}
                      onBlur={() => renameCategory(cat, catDraft)}
                      onKeyDown={(e) => e.key === "Escape" && setEditingCat(null)}
                      className="border border-amber-400 rounded-lg px-2 py-0.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 w-40"
                      disabled={renamingCat}
                      autoFocus
                    />
                    <button type="submit" disabled={renamingCat}
                      className="text-xs bg-amber-500 text-white font-semibold px-2 py-0.5 rounded-lg">
                      {renamingCat ? "…" : "✓"}
                    </button>
                    <button type="button" onClick={() => setEditingCat(null)}
                      className="text-xs text-slate-400 hover:text-slate-600">✕</button>
                  </form>
                ) : (
                  <button className="font-bold text-slate-700 flex items-center gap-1.5 group hover:text-amber-600"
                    title="Click to rename"
                    onClick={() => { setEditingCat(cat); setCatDraft(cat); setTimeout(() => catInputRef.current?.focus(), 50); }}>
                    {cat}
                    <span className="text-slate-400 text-sm font-normal">({catItems.length})</span>
                    <span className="text-xs text-slate-300 group-hover:text-amber-400">✏️</span>
                  </button>
                )}
                <div className="flex gap-2">
                  <button onClick={() => setCategoryAvail(cat, true)} className="text-xs bg-green-100 hover:bg-green-200 text-green-700 font-semibold px-3 py-1 rounded-lg">
                    All On
                  </button>
                  <button onClick={() => setCategoryAvail(cat, false)} className="text-xs bg-red-100 hover:bg-red-200 text-red-700 font-semibold px-3 py-1 rounded-lg">
                    All Off
                  </button>
                </div>
              </div>
              <div className="divide-y divide-slate-50">
                {catItems.map((item) => {
                  const avail = getAvail(item);
                  const changed = pendingAvail[item.id] !== undefined && pendingAvail[item.id] !== item.available;
                  return (
                    <div key={item.id} className={`flex items-center gap-4 px-5 py-3.5 transition-colors ${changed ? "bg-amber-50/60" : ""}`}>
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-sm ${avail ? "text-slate-800" : "text-slate-400"}`}>{item.name}</p>
                        <p className="text-xs text-slate-400">₹{item.price.toFixed(0)}</p>
                      </div>
                      {changed && <span className="text-xs text-amber-600 font-medium">unsaved</span>}
                      {/* Toggle switch */}
                      <button
                        onClick={() => togglePending(item.id, !avail)}
                        className={`relative w-12 h-6 rounded-full transition-colors ${avail ? "bg-green-500" : "bg-slate-200"}`}
                        title={avail ? "Click to mark unavailable" : "Click to mark available"}
                      >
                        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${avail ? "left-7" : "left-1"}`} />
                      </button>
                      <span className={`text-xs font-semibold w-20 text-right ${avail ? "text-green-600" : "text-red-500"}`}>
                        {avail ? "Available" : "Unavailable"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "manage" && <>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or category..."
        className="w-full border border-slate-200 rounded-xl px-4 py-2.5 mb-6 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
      />

      {loading ? (
        <div className="text-center py-20 text-slate-400">
          <div className="text-5xl animate-pulse mb-3">🍴</div>
          <p>Loading menu...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <div className="text-5xl mb-3">🍴</div>
          <p className="text-lg">No menu items yet</p>
          <button
            onClick={openCreate}
            className="mt-4 bg-amber-500 text-white px-6 py-2 rounded-lg font-medium"
          >
            Add your first item
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([cat, catItems]) => (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 bg-amber-400 rounded-full flex-shrink-0" />
                {editingCat === cat ? (
                  <form
                    className="flex items-center gap-2 flex-1"
                    onSubmit={(e) => { e.preventDefault(); renameCategory(cat, catDraft); }}
                  >
                    <input
                      ref={catInputRef}
                      value={catDraft}
                      onChange={(e) => setCatDraft(e.target.value)}
                      onBlur={() => renameCategory(cat, catDraft)}
                      onKeyDown={(e) => e.key === "Escape" && setEditingCat(null)}
                      className="border border-amber-400 rounded-lg px-3 py-1 text-base font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 w-48"
                      disabled={renamingCat}
                      autoFocus
                    />
                    <button type="submit" disabled={renamingCat}
                      className="text-xs bg-amber-500 text-white font-semibold px-3 py-1 rounded-lg hover:bg-amber-600 disabled:opacity-50">
                      {renamingCat ? "…" : "Save"}
                    </button>
                    <button type="button" onClick={() => setEditingCat(null)}
                      className="text-xs bg-slate-200 text-slate-600 font-semibold px-3 py-1 rounded-lg hover:bg-slate-300">
                      Cancel
                    </button>
                  </form>
                ) : (
                  <button
                    className="text-lg font-bold text-slate-700 hover:text-amber-600 flex items-center gap-2 group"
                    title="Click to rename section"
                    onClick={() => { setEditingCat(cat); setCatDraft(cat); setTimeout(() => catInputRef.current?.focus(), 50); }}
                  >
                    {cat}
                    <span className="text-slate-400 text-sm font-normal">({catItems.length})</span>
                    <span className="text-xs text-slate-300 group-hover:text-amber-400 transition-colors">✏️</span>
                  </button>
                )}
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 divide-y divide-slate-100">
                {catItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-4 px-5 py-4">
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0 text-2xl">
                        🍽️
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800">{item.name}</p>
                      {item.description && (
                        <p className="text-slate-500 text-sm truncate">{item.description}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-amber-600">₹{item.price.toFixed(2)}</p>
                    </div>
                    <button
                      onClick={() => toggleAvailable(item)}
                      className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                        item.available
                          ? "bg-green-100 text-green-700 hover:bg-green-200"
                          : "bg-red-100 text-red-600 hover:bg-red-200"
                      }`}
                    >
                      {item.available ? "Available" : "Unavailable"}
                    </button>
                    <button
                      onClick={() => openEdit(item)}
                      className="flex-shrink-0 text-slate-400 hover:text-slate-700 transition-colors p-1"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={deletingId === item.id}
                      className="flex-shrink-0 text-slate-300 hover:text-red-500 transition-colors p-1 disabled:opacity-50"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      </>}

      {/* Scanner modal */}
      {scannerOpen && (
        <MenuScanner
          onClose={() => setScannerOpen(false)}
          onImported={() => { fetchItems(); setScannerOpen(false); }}
        />
      )}

      {/* Form modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setFormOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800">
                {editItem ? "Edit Item" : "Add Menu Item"}
              </h2>
              <button
                onClick={() => setFormOpen(false)}
                className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
              {(
                [
                  { label: "Item Name *", key: "name", type: "text", required: true, placeholder: "e.g. Butter Chicken" },
                  { label: "Category *", key: "category", type: "text", required: true, placeholder: "e.g. Main Course" },
                  { label: "Price (₹) *", key: "price", type: "number", required: true, placeholder: "199" },
                  { label: "Description", key: "description", type: "text", required: false, placeholder: "Brief description" },
                  { label: "Image URL (optional)", key: "imageUrl", type: "url", required: false, placeholder: "https://..." },
                  { label: "Sort Order", key: "sortOrder", type: "number", required: false, placeholder: "0" },
                ] as const
              ).map((field) => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{field.label}</label>
                  <input
                    type={field.type}
                    value={form[field.key] as string}
                    onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
                    required={field.required}
                    placeholder={field.placeholder}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              ))}

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="available"
                  checked={form.available}
                  onChange={(e) => setForm((f) => ({ ...f, available: e.target.checked }))}
                  className="w-4 h-4 accent-amber-500"
                />
                <label htmlFor="available" className="text-sm font-medium text-slate-700">
                  Available for ordering
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="flex-1 border border-slate-300 text-slate-700 font-medium py-2.5 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-bold py-2.5 rounded-xl transition-colors"
                >
                  {saving ? "Saving..." : editItem ? "Save Changes" : "Add Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

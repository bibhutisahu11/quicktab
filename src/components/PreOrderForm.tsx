"use client";

import { useState } from "react";

interface Sweet {
  id: string;
  name: string;
  pricePerUnit: number;
  unit: string;
  imageUrl?: string | null;
}

interface Props {
  orgSlug: string;
  orgName: string;
  orgLogo?: string | null;
  sweets: Sweet[];
}

interface OrderedItem {
  sweetId: string;
  quantity: number;
  customGrams?: number;
}

interface SuccessData {
  id: string;
  totalAmount: number;
  paymentDeadline: string;
}

export default function PreOrderForm({ orgSlug, orgName, orgLogo, sweets }: Props) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [customGrams, setCustomGrams] = useState<Record<string, number>>({});
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<SuccessData | null>(null);

  const setQty = (id: string, delta: number) => {
    setQuantities((prev) => {
      const cur = prev[id] ?? 0;
      const next = Math.max(0, Math.min(20, cur + delta));
      return { ...prev, [id]: next };
    });
  };

  const adjustGrams = (id: string, delta: number) => {
    setCustomGrams((prev) => {
      const cur = prev[id] ?? 0;
      const next = Math.max(0, cur + delta);
      return { ...prev, [id]: next };
    });
  };

  const setGramsDirect = (id: string, value: string) => {
    const num = parseInt(value.replace(/\D/g, ""), 10);
    setCustomGrams((prev) => ({ ...prev, [id]: isNaN(num) ? 0 : Math.max(0, num) }));
  };

  const total = sweets.reduce((sum, s) => {
    if (s.unit === "kg") {
      const grams = customGrams[s.id] ?? 0;
      return sum + (grams / 1000) * s.pricePerUnit;
    }
    return sum + (quantities[s.id] ?? 0) * s.pricePerUnit;
  }, 0);

  const itemCount = sweets.reduce((count, s) => {
    if (s.unit === "kg") {
      return count + ((customGrams[s.id] ?? 0) > 0 ? 1 : 0);
    }
    return count + (quantities[s.id] ?? 0);
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!customerName.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (!/^\d{10}$/.test(phone.trim())) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (itemCount === 0) {
      setError("Please add at least one sweet to your order.");
      return;
    }

    const items: OrderedItem[] = sweets
      .filter((s) => {
        if (s.unit === "kg") return (customGrams[s.id] ?? 0) > 0;
        return (quantities[s.id] ?? 0) > 0;
      })
      .map((s) => {
        if (s.unit === "kg") {
          return { sweetId: s.id, quantity: 1, customGrams: customGrams[s.id] };
        }
        return { sweetId: s.id, quantity: quantities[s.id] };
      });

    setLoading(true);
    try {
      const res = await fetch("/api/pre-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgSlug,
          customerName: customerName.trim(),
          phone: phone.trim(),
          items,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setSuccess({
        id: data.id,
        totalAmount: data.totalAmount,
        paymentDeadline: data.paymentDeadline,
      });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    const deadline = new Date(success.paymentDeadline);
    const deadlineStr = deadline.toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Order Placed!</h2>
          <p className="text-slate-600 mb-6">We&apos;ll call you shortly to confirm!</p>

          <div className="bg-amber-50 rounded-xl p-4 mb-6 text-left space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Order ID</span>
              <span className="font-mono text-slate-800 font-medium">{success.id.slice(-8).toUpperCase()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Total Amount</span>
              <span className="font-bold text-slate-800">₹{success.totalAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Payment Deadline</span>
              <span className="text-amber-700 font-medium">{deadlineStr}</span>
            </div>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-sm text-orange-800">
            ⚠️ Payment must be made <strong>1 day before pickup</strong> to confirm your order.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-6 text-white shadow-lg">
        <div className="max-w-lg mx-auto flex items-center gap-4">
          {orgLogo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={orgLogo} alt={orgName} className="w-14 h-14 rounded-xl object-contain bg-white/20 p-1 flex-shrink-0 shadow-md" />
          )}
          <div>
            <h1 className="text-xl font-bold leading-snug">
              🎁 Raksha Bandhan Sweet Pre-Order — {orgName}
            </h1>
            <p className="mt-1 text-amber-100 text-sm">
              Reserve your sweets now! ⚠️ Payment required 1 day before pickup to confirm your order.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Sweet Cards */}
        {sweets.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center text-slate-500">
            No sweets available at the moment. Please check back soon!
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="font-semibold text-slate-700 text-sm uppercase tracking-wide mt-2">
              Select Sweets
            </h2>
            {sweets.map((sweet) => {
              const isKg = sweet.unit === "kg";
              const qty = quantities[sweet.id] ?? 0;
              const grams = customGrams[sweet.id] ?? 0;
              const linePrice = isKg
                ? (grams / 1000) * sweet.pricePerUnit
                : qty * sweet.pricePerUnit;
              const hasSelection = isKg ? grams > 0 : qty > 0;

              return (
                <div
                  key={sweet.id}
                  className="bg-white rounded-xl shadow-sm p-4 flex items-center justify-between gap-3"
                >
                  {/* Sweet image */}
                  {sweet.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={sweet.imageUrl}
                      alt={sweet.name}
                      className="w-14 h-14 rounded-lg object-cover flex-shrink-0 border border-slate-100"
                    />
                  )}
                  <div className="flex-1 min-w-0 pr-3">
                    <p className="font-semibold text-slate-800 truncate">{sweet.name}</p>
                    <p className="text-sm text-slate-500">
                      ₹{sweet.pricePerUnit.toFixed(2)} / {sweet.unit}
                    </p>
                    {hasSelection && (
                      <p className="text-xs text-amber-600 font-medium mt-0.5">
                        ₹{linePrice.toFixed(2)} total
                      </p>
                    )}
                    {isKg && grams > 0 && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        {grams}g = ₹{linePrice.toFixed(2)}
                      </p>
                    )}
                  </div>

                  {isKg ? (
                    /* Gram input for kg-unit sweets */
                    <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => adjustGrams(sweet.id, -50)}
                          disabled={grams < 50}
                          className="w-9 h-8 rounded-lg bg-amber-100 text-amber-700 font-bold text-xs flex items-center justify-center disabled:opacity-30 hover:bg-amber-200 transition-colors"
                        >
                          −50
                        </button>
                        <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
                          <input
                            type="number"
                            min="0"
                            step="50"
                            value={grams === 0 ? "" : grams}
                            onChange={(e) => setGramsDirect(sweet.id, e.target.value)}
                            placeholder="0"
                            className="w-14 text-center text-sm font-bold text-slate-800 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                          />
                          <span className="pr-2 text-xs text-slate-400 font-medium">g</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => adjustGrams(sweet.id, 50)}
                          className="w-9 h-8 rounded-lg bg-amber-500 text-white font-bold text-xs flex items-center justify-center hover:bg-amber-600 transition-colors"
                        >
                          +50
                        </button>
                      </div>
                      <span className="text-xs text-slate-400">grams</span>
                    </div>
                  ) : (
                    /* Standard +/- stepper for piece / 100g sweets */
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => setQty(sweet.id, -1)}
                        disabled={qty === 0}
                        className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 font-bold text-lg flex items-center justify-center disabled:opacity-30 hover:bg-amber-200 transition-colors"
                      >
                        −
                      </button>
                      <span className="w-6 text-center font-bold text-slate-800 text-sm">{qty}</span>
                      <button
                        type="button"
                        onClick={() => setQty(sweet.id, 1)}
                        disabled={qty === 20}
                        className="w-8 h-8 rounded-full bg-amber-500 text-white font-bold text-lg flex items-center justify-center disabled:opacity-50 hover:bg-amber-600 transition-colors"
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Customer Details */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <h2 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">
            Your Details
          </h2>

          <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Enter your full name"
                autoComplete="off"
                required
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-slate-800 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Mobile Number <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="10-digit mobile number"
                autoComplete="off"
                required
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-slate-800 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Special Instructions (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any special requests..."
                autoComplete="off"
                rows={2}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-slate-800 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm resize-none"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {/* Running Total + Submit */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex justify-between items-center mb-4">
              <span className="text-slate-600 font-medium">
                {itemCount} item{itemCount !== 1 ? "s" : ""}
              </span>
              <span className="text-xl font-bold text-slate-800">₹{total.toFixed(2)}</span>
            </div>

            <button
              type="submit"
              disabled={loading || itemCount === 0}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-base shadow-md disabled:opacity-50 hover:from-amber-600 hover:to-orange-600 transition-all"
            >
              {loading ? "Placing Order…" : "Place Pre-Order 🎁"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

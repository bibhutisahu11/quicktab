"use client";

import { useState } from "react";

const ORG_SLUG = "kalinga-bites";

const TIME_SLOTS = [
  "11:00 AM – 12:00 PM",
  "12:00 PM – 01:00 PM",
  "01:00 PM – 02:00 PM",
  "02:00 PM – 03:00 PM",
  "03:00 PM – 04:00 PM",
  "06:00 PM – 07:00 PM",
  "07:00 PM – 08:00 PM",
  "08:00 PM – 09:00 PM",
  "09:00 PM – 10:00 PM",
];

const DATE_OPTIONS = [
  { value: "2024-11-28", label: "Thursday, 28th November 2024" },
  { value: "2024-11-29", label: "Friday, 29th November 2024" },
];

interface FormState {
  name: string;
  phone: string;
  persons: string;
  visitDate: string;
  visitTime: string;
}

interface FieldError {
  name?: string;
  phone?: string;
  persons?: string;
  visitDate?: string;
  visitTime?: string;
}

export default function ChhadakhaiPage() {
  const [form, setForm] = useState<FormState>({
    name: "", phone: "", persons: "", visitDate: "", visitTime: "",
  });
  const [errors, setErrors] = useState<FieldError>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [serverError, setServerError] = useState("");

  function validate(): boolean {
    const e: FieldError = {};
    if (!form.name.trim())               e.name     = "Please enter your name";
    else if (form.name.trim().length < 2) e.name    = "Name must be at least 2 characters";
    if (!form.phone.trim())              e.phone    = "Please enter your mobile number";
    else if (!/^\d{10}$/.test(form.phone.trim())) e.phone = "Enter a valid 10-digit mobile number";
    if (!form.persons)                   e.persons  = "Please enter number of persons";
    else if (Number(form.persons) < 1)   e.persons  = "Minimum 1 person";
    else if (Number(form.persons) > 50)  e.persons  = "Maximum 50 persons per booking";
    if (!form.visitDate)                 e.visitDate = "Please select a date";
    if (!form.visitTime)                 e.visitTime = "Please select a time slot";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError("");
    if (!validate()) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/chhadakhai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          persons: Number(form.persons),
          orgSlug: ORG_SLUG,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setServerError(data.error ?? "Something went wrong"); return; }
      setSuccess(true);
    } catch {
      setServerError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-black text-slate-800 mb-2">Booking Confirmed!</h2>
          <p className="text-amber-600 font-bold text-lg mb-4">ଶୁଭ ଛାଡ଼ଖାଇ! 🙏</p>
          <div className="bg-amber-50 rounded-2xl p-4 text-left space-y-2 mb-6">
            <p className="text-sm text-slate-600"><span className="font-semibold">Name:</span> {form.name}</p>
            <p className="text-sm text-slate-600"><span className="font-semibold">Date:</span> {DATE_OPTIONS.find(d => d.value === form.visitDate)?.label}</p>
            <p className="text-sm text-slate-600"><span className="font-semibold">Time:</span> {form.visitTime}</p>
            <p className="text-sm text-slate-600"><span className="font-semibold">Persons:</span> {form.persons}</p>
            <p className="text-sm text-slate-600"><span className="font-semibold">Mobile:</span> {form.phone}</p>
          </div>
          <p className="text-sm text-slate-500">Please show this confirmation at the entrance. See you at Kalinga Bites! 🍽️</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 text-white px-4 py-8 text-center shadow-lg">
        <p className="text-4xl mb-2">🎊</p>
        <h1 className="text-3xl font-black tracking-tight">ଛାଡ଼ଖାଇ</h1>
        <p className="text-xl font-bold opacity-90 mt-1">Chhadakhai Special Thali</p>
        <p className="text-amber-100 text-sm mt-2 font-medium">28th & 29th November 2024 · Kalinga Bites</p>
        <p className="text-amber-100 text-xs mt-1 opacity-80">Book your table and celebrate with us!</p>
      </div>

      {/* Thali Menu */}
      <div className="max-w-md mx-auto px-4 pt-6 pb-2">
        <div className="bg-white rounded-3xl shadow-lg overflow-hidden border border-amber-100">
          {/* Card Header */}
          <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-400 px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-orange-100 uppercase tracking-widest mb-0.5">What&apos;s Included</p>
              <h3 className="text-white text-lg font-black leading-tight">Chhadakhai Special Thali</h3>
            </div>
            <div className="bg-white/20 backdrop-blur-sm border border-white/40 rounded-2xl px-4 py-2 text-center shrink-0 ml-3">
              <p className="text-white text-xl font-black leading-none">₹599</p>
              <p className="text-orange-100 text-xs font-semibold mt-0.5">per person</p>
            </div>
          </div>

          {/* Items Grid */}
          <div className="px-4 py-4">
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: "🍚", name: "Rice" },
                { icon: "🫕", name: "Dal" },
                { icon: "🍍", name: "Pineapple Khatta" },
                { icon: "🥘", name: "Bhaja" },
                { icon: "🍖", name: "Mutton Curry (2 pcs)" },
                { icon: "🍗", name: "Chicken Kassa (2 pcs)" },
                { icon: "🐟", name: "Fish Tawa Fry (1 pc)" },
                { icon: "🦐", name: "Prawn Rai (2 pcs)" },
                { icon: "🍗", name: "Chicken Pakoda (2 pcs)" },
                { icon: "🍛", name: "Biryani Rice" },
                { icon: "🍮", name: "Gulab Jamun" },
                { icon: "🫓", name: "Papad" },
              ].map((item) => (
                <div
                  key={item.name}
                  className="flex items-center gap-2 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl px-3 py-2"
                >
                  <span className="text-base leading-none shrink-0">{item.icon}</span>
                  <span className="text-xs font-semibold text-amber-900 leading-tight">{item.name}</span>
                </div>
              ))}
            </div>
            <p className="text-center text-xs text-slate-400 mt-3 font-medium">🌟 Fresh · Authentic · Festive</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-md mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} noValidate className="bg-white rounded-3xl shadow-xl p-6 space-y-5">
          <h2 className="text-lg font-black text-slate-800 text-center">Reserve Your Spot 🪑</h2>

          {serverError && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 font-medium">
              ⚠️ {serverError}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">Full Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => { setForm(f => ({ ...f, name: e.target.value })); setErrors(er => ({ ...er, name: undefined })); }}
              placeholder="e.g. Ramesh Kumar"
              className={`w-full border rounded-xl px-4 py-3 text-slate-800 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 ${errors.name ? "border-red-400 bg-red-50" : "border-slate-300"}`}
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">⚠ {errors.name}</p>}
          </div>

          {/* Mobile */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">Mobile Number *</label>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={form.phone}
              onChange={(e) => { setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, "") })); setErrors(er => ({ ...er, phone: undefined })); }}
              placeholder="10-digit mobile number"
              className={`w-full border rounded-xl px-4 py-3 text-slate-800 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 ${errors.phone ? "border-red-400 bg-red-50" : "border-slate-300"}`}
            />
            {errors.phone && <p className="text-xs text-red-500 mt-1">⚠ {errors.phone}</p>}
          </div>

          {/* Number of persons */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">Number of Persons *</label>
            <input
              type="number"
              min={1}
              max={50}
              inputMode="numeric"
              value={form.persons}
              onChange={(e) => { setForm(f => ({ ...f, persons: e.target.value })); setErrors(er => ({ ...er, persons: undefined })); }}
              placeholder="How many people?"
              className={`w-full border rounded-xl px-4 py-3 text-slate-800 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 ${errors.persons ? "border-red-400 bg-red-50" : "border-slate-300"}`}
            />
            {errors.persons && <p className="text-xs text-red-500 mt-1">⚠ {errors.persons}</p>}
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">Date of Visit *</label>
            <div className="grid grid-cols-2 gap-3">
              {DATE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { setForm(f => ({ ...f, visitDate: opt.value })); setErrors(er => ({ ...er, visitDate: undefined })); }}
                  className={`border-2 rounded-xl px-3 py-3 text-sm font-bold transition-all ${
                    form.visitDate === opt.value
                      ? "border-amber-500 bg-amber-50 text-amber-700"
                      : "border-slate-200 text-slate-600 hover:border-amber-300"
                  }`}
                >
                  <p className="text-lg">📅</p>
                  <p>{opt.value.endsWith("28") ? "28th Nov" : "29th Nov"}</p>
                  <p className="text-xs opacity-70">{opt.value.endsWith("28") ? "Thursday" : "Friday"}</p>
                </button>
              ))}
            </div>
            {errors.visitDate && <p className="text-xs text-red-500 mt-1">⚠ {errors.visitDate}</p>}
          </div>

          {/* Time slot */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">Time Slot *</label>
            <div className="grid grid-cols-2 gap-2">
              {TIME_SLOTS.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => { setForm(f => ({ ...f, visitTime: slot })); setErrors(er => ({ ...er, visitTime: undefined })); }}
                  className={`border-2 rounded-xl px-2 py-2.5 text-xs font-semibold transition-all ${
                    form.visitTime === slot
                      ? "border-amber-500 bg-amber-50 text-amber-700"
                      : "border-slate-200 text-slate-600 hover:border-amber-300"
                  }`}
                >
                  🕐 {slot}
                </button>
              ))}
            </div>
            {errors.visitTime && <p className="text-xs text-red-500 mt-1">⚠ {errors.visitTime}</p>}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-60 text-white font-black py-4 rounded-2xl text-base transition-all shadow-lg shadow-amber-200 mt-2"
          >
            {submitting ? "Booking..." : "🎊 Confirm Booking"}
          </button>

          <p className="text-center text-xs text-slate-400">
            By booking, you agree to arrive within your selected time slot.
          </p>
        </form>
      </div>
    </div>
  );
}

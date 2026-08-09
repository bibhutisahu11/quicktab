"use client";

import { useState, useRef, useEffect } from "react";
import QRCode from "qrcode";
import { CartItem, DiscountData, AppliedDiscount } from "@/types";
import { validatePhone, validateEmail } from "@/lib/validators";
import { applyDiscounts, totalDiscount, DAY_NAMES } from "@/lib/discountEngine";

interface CheckoutModalProps {
  open: boolean;
  onClose: () => void;
  cart: CartItem[];
  onPlaceOrder: (
    name: string,
    phone: string,
    notes: string,
    address: string,
    email: string,
    birthday: string,
    upiUtr?: string,
    paymentScreenshot?: string,
    discountAmount?: number,
  ) => Promise<void>;
  isParcel: boolean;
  orgUpiId: string | null;
  orgSlug?: string;
  isDiningCustomer?: boolean;
}

// UTR validation: 6–22 alphanumeric characters (covers NEFT/IMPS/UPI formats)
function validateUtr(utr: string): string | null {
  const trimmed = utr.trim();
  if (!trimmed) return "UTR / Transaction ID is required";
  if (!/^[A-Za-z0-9]{6,22}$/.test(trimmed))
    return "Enter a valid UTR (6–22 alphanumeric characters, no spaces)";
  return null;
}

const MAX_SCREENSHOT_BYTES = 2 * 1024 * 1024; // 2 MB

export default function CheckoutModal({
  open,
  onClose,
  cart,
  onPlaceOrder,
  isParcel,
  orgUpiId,
  orgSlug,
  isDiningCustomer = false,
}: CheckoutModalProps) {
  /* ── step 1 fields ── */
  const [name, setName]       = useState("");
  const [phone, setPhone]     = useState("");
  const [email, setEmail]     = useState("");
  const [birthday, setBirthday] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes]     = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [emailError, setEmailError] = useState("");

  /* ── step 2 (payment) fields ── */
  const [upiUtr, setUpiUtr]               = useState("");
  const [utrError, setUtrError]           = useState("");
  const [screenshot, setScreenshot]       = useState<string | null>(null);
  const [screenshotName, setScreenshotName] = useState("");
  const [screenshotError, setScreenshotError] = useState("");
  const [upiQrDataUrl, setUpiQrDataUrl]   = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /* ── discounts ── */
  const [discounts, setDiscounts] = useState<DiscountData[]>([]);
  useEffect(() => {
    if (!open || !orgSlug) return;
    fetch(`/api/public/discounts?orgSlug=${orgSlug}`)
      .then((r) => r.ok ? r.json() : [])
      .then(setDiscounts)
      .catch(() => {});
  }, [open, orgSlug]);

  /* ── shared ── */
  const [step, setStep]     = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const appliedDiscounts: AppliedDiscount[] = applyDiscounts(discounts, cart, subtotal);
  const discountAmount = totalDiscount(appliedDiscounts);
  const total = Math.max(0, subtotal - discountAmount);
  const requirePayment = !!orgUpiId;

  /* ── UPI QR generation (runs when payment step is shown) ── */
  useEffect(() => {
    if (step !== 2 || !orgUpiId) return;
    const upiUri = `upi://pay?pa=${encodeURIComponent(orgUpiId)}&am=${total.toFixed(2)}&cu=INR&tn=${encodeURIComponent("Food order")}`;
    QRCode.toDataURL(upiUri, { width: 260, margin: 1, color: { dark: "#1e293b", light: "#ffffff" } })
      .then(setUpiQrDataUrl)
      .catch(() => setUpiQrDataUrl(null));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, orgUpiId, total]);

  if (!open) return null;

  /* ── helpers ── */
  function resetAndClose() {
    setName(""); setPhone(""); setEmail(""); setBirthday(""); setAddress(""); setNotes("");
    setUpiUtr(""); setUtrError(""); setScreenshot(null); setScreenshotName(""); setScreenshotError("");
    setUpiQrDataUrl(null);
    setStep(1); setLoading(false); setError("");
    setPhoneError(""); setEmailError("");
    onClose();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setScreenshotError("");
    if (!file.type.startsWith("image/")) {
      setScreenshotError("Please upload an image file (PNG, JPG, etc.)");
      return;
    }
    if (file.size > MAX_SCREENSHOT_BYTES) {
      setScreenshotError("Image too large — max 2 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setScreenshot(reader.result as string);
      setScreenshotName(file.name);
    };
    reader.readAsDataURL(file);
  }

  /* ── step 1 → step 2 ── */
  function handleStep1Submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const pErr = phone ? validatePhone(phone) : null;
    const eErr = email ? validateEmail(email) : null;
    if (pErr) { setPhoneError(pErr); return; }
    if (eErr) { setEmailError(eErr); return; }
    if (requirePayment) {
      setStep(2);
    } else {
      submitOrder();
    }
  }

  /* ── step 2 → submit ── */
  function handleStep2Submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const utrErr = validateUtr(upiUtr);
    if (utrErr) { setUtrError(utrErr); return; }
    if (!screenshot) { setScreenshotError("Please upload your payment screenshot"); return; }
    submitOrder();
  }

  async function submitOrder() {
    setLoading(true);
    try {
      await onPlaceOrder(
        name, phone, notes, address, email, birthday,
        requirePayment ? upiUtr.trim() : undefined,
        requirePayment ? screenshot ?? undefined : undefined,
        discountAmount > 0 ? discountAmount : undefined,
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  /* ── shared form section helpers ── */
  const inputCls = (err?: string) =>
    `w-full border rounded-lg px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent ${err ? "border-red-400 bg-red-50" : "border-slate-300"}`;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={resetAndClose} />
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            {requirePayment && (
              <div className="flex items-center gap-1 text-xs">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${step === 1 ? "bg-amber-500 text-white" : "bg-green-500 text-white"}`}>
                  {step === 1 ? "1" : "✓"}
                </span>
                <span className={`text-xs font-medium ${step === 1 ? "text-amber-600" : "text-green-600"}`}>Details</span>
                <span className="text-slate-300 mx-1">→</span>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${step === 2 ? "bg-amber-500 text-white" : "bg-slate-200 text-slate-500"}`}>2</span>
                <span className={`text-xs font-medium ${step === 2 ? "text-amber-600" : "text-slate-400"}`}>Payment</span>
              </div>
            )}
            {!requirePayment && (
              <h2 className="text-xl font-bold text-slate-800">
                {isParcel ? "📦 Parcel Order" : "🍽️ Table Order"}
              </h2>
            )}
          </div>
          <button
            onClick={resetAndClose}
            className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mx-5 mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {/* ── STEP 1: Customer details ── */}
        {step === 1 && (
          <form onSubmit={handleStep1Submit} className="px-5 py-5 space-y-5">

            {/* Priority dining customer banner */}
            {isDiningCustomer && (
              <div className="bg-gradient-to-r from-amber-400 to-orange-400 rounded-2xl px-4 py-3 flex items-center gap-3 shadow">
                <span className="text-2xl">🍽️</span>
                <div className="flex-1">
                  <p className="font-black text-white text-sm">You&apos;re already dining with us!</p>
                  <p className="text-amber-100 text-xs">Your order will be prioritized. Eat slowly &amp; enjoy 😊🌟🍛</p>
                </div>
                <span className="text-xl">⭐</span>
              </div>
            )}

            {/* Order summary */}
            <div className="bg-slate-50 rounded-xl p-4 space-y-2">
              <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">Order Summary</h3>
              {cart.map((item) => (
                <div key={item.menuItemId} className="flex justify-between text-sm">
                  <span className="text-slate-600">{item.name} × {item.quantity}</span>
                  <span className="font-medium text-slate-800">₹{(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
              {appliedDiscounts.length > 0 && (
                <>
                  <div className="border-t border-slate-200 pt-2 flex justify-between text-sm text-slate-500">
                    <span>Subtotal</span>
                    <span>₹{subtotal.toFixed(2)}</span>
                  </div>
                  {appliedDiscounts.map(({ discount, saving }) => (
                    <div key={discount.id} className="flex justify-between text-sm text-green-700 font-medium">
                      <span className="flex items-center gap-1">
                        🏷️ {discount.name}
                        {discount.daysOfWeek.length > 0 && (
                          <span className="text-xs text-green-500">({discount.daysOfWeek.map((d) => DAY_NAMES[d]).join(", ")})</span>
                        )}
                      </span>
                      <span>−₹{saving.toFixed(2)}</span>
                    </div>
                  ))}
                </>
              )}
              <div className="border-t border-slate-200 pt-2 flex justify-between font-bold">
                <span>Total</span>
                <span className={appliedDiscounts.length > 0 ? "text-green-600" : "text-amber-600"}>₹{total.toFixed(2)}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Your Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className={inputCls()}
                placeholder="Enter your name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Phone Number {isParcel && <span className="text-red-500">*</span>}
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); setPhoneError(""); }}
                onBlur={() => setPhoneError(validatePhone(phone) ?? "")}
                required={isParcel}
                className={inputCls(phoneError)}
                placeholder="+91 98765 43210"
              />
              {phoneError && <p className="text-red-500 text-xs mt-1">{phoneError}</p>}
            </div>

            {/* Optional extras */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">🎁</span>
                <p className="text-sm font-semibold text-amber-800">Get exclusive offers!</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Email Address <span className="text-slate-400 text-xs">(optional)</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
                  onBlur={() => setEmailError(validateEmail(email) ?? "")}
                  className={`${inputCls(emailError)} bg-white`}
                  placeholder="you@example.com"
                />
                {emailError && <p className="text-red-500 text-xs mt-1">{emailError}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Your Birthday <span className="text-slate-400 text-xs">(optional)</span>
                </label>
                <input
                  type="date"
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                />
                <p className="text-xs text-amber-700 mt-1.5 flex items-center gap-1">
                  🎂 We might surprise you with free sweets or discounts on your party order!
                </p>
              </div>
            </div>

            {isParcel && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Delivery Address <span className="text-slate-400 text-xs">(optional)</span>
                </label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={2}
                  className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                  placeholder="House / flat, street, area..."
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Special Instructions <span className="text-slate-400 text-xs">(optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                placeholder="Any allergies or special requests..."
              />
            </div>

            <button
              type="submit"
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-4 rounded-xl text-lg transition-colors"
            >
              {requirePayment ? `Proceed to Pay · ₹${total.toFixed(2)} →` : `Place Order · ₹${total.toFixed(2)}`}
            </button>
          </form>
        )}

        {/* ── STEP 2: UPI Payment ── */}
        {step === 2 && orgUpiId && (
          <form onSubmit={handleStep2Submit} className="px-5 py-5 space-y-5">
            {/* UPI QR + instructions */}
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-2xl p-5 text-center space-y-4">
              <p className="text-sm font-semibold text-indigo-700 uppercase tracking-wide">Scan &amp; Pay via UPI</p>

              {/* Scannable QR code */}
              {upiQrDataUrl ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="bg-white p-3 rounded-2xl shadow-md border border-indigo-100 inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={upiQrDataUrl} alt="UPI QR Code" width={220} height={220} className="rounded-lg" />
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    {/* UPI app logos */}
                    {["PhonePe", "GPay", "Paytm", "BHIM"].map((app) => (
                      <span key={app} className="text-xs font-semibold text-indigo-600 bg-indigo-100 rounded-full px-2 py-0.5">{app}</span>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500">Scan with any UPI app camera</p>
                </div>
              ) : (
                <div className="flex items-center justify-center h-32 text-slate-400 text-sm">Generating QR…</div>
              )}

              {/* Amount pill */}
              <div className="bg-amber-500 text-white rounded-xl py-3 px-5 inline-block mx-auto">
                <p className="font-black text-xl">₹{total.toFixed(2)}</p>
                <p className="text-amber-100 text-xs">Amount to pay</p>
              </div>

              {/* Manual UPI ID fallback */}
              <div className="bg-white rounded-xl py-3 px-5 border border-indigo-100 text-center">
                <p className="text-xs text-slate-400 mb-1">Or pay manually to UPI ID</p>
                <p className="text-lg font-black text-slate-800 tracking-tight">{orgUpiId}</p>
              </div>

              <div className="text-left bg-white rounded-xl p-4 border border-indigo-100 space-y-1.5 text-sm text-slate-600">
                <p className="font-semibold text-slate-700">📋 Steps:</p>
                <p>1. Scan the QR above <em>or</em> open PhonePe / GPay / Paytm</p>
                <p>2. Pay <strong>₹{total.toFixed(2)}</strong> — amount auto-filled when scanned</p>
                <p>3. Take a screenshot of the success screen</p>
                <p>4. Upload the screenshot &amp; enter the UTR below</p>
              </div>
            </div>

            {/* Screenshot upload */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Payment Screenshot <span className="text-red-500">*</span>
              </label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
              />
              {screenshot ? (
                <div className="relative rounded-xl overflow-hidden border-2 border-green-400 bg-green-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={screenshot} alt="Payment screenshot" className="w-full max-h-48 object-contain" />
                  <button
                    type="button"
                    onClick={() => { setScreenshot(null); setScreenshotName(""); if (fileRef.current) fileRef.current.value = ""; }}
                    className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center text-sm font-bold hover:bg-red-600"
                  >
                    ✕
                  </button>
                  <div className="px-3 py-2 bg-green-100 flex items-center gap-2 text-green-700 text-sm font-medium">
                    <span>✅</span> {screenshotName}
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className={`w-full border-2 border-dashed rounded-xl py-8 flex flex-col items-center gap-2 transition-colors ${screenshotError ? "border-red-400 bg-red-50" : "border-slate-300 hover:border-amber-400 hover:bg-amber-50"}`}
                >
                  <span className="text-3xl">📸</span>
                  <span className="text-sm font-medium text-slate-600">Tap to upload screenshot</span>
                  <span className="text-xs text-slate-400">PNG, JPG — max 2 MB</span>
                </button>
              )}
              {screenshotError && <p className="text-red-500 text-xs mt-1">{screenshotError}</p>}
            </div>

            {/* UTR input */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                UTR / Transaction ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={upiUtr}
                onChange={(e) => { setUpiUtr(e.target.value.toUpperCase()); setUtrError(""); }}
                onBlur={() => setUtrError(validateUtr(upiUtr) ?? "")}
                className={inputCls(utrError)}
                placeholder="e.g. 407812345678 or T2506041234"
                maxLength={22}
                autoCapitalize="characters"
              />
              {utrError && <p className="text-red-500 text-xs mt-1">{utrError}</p>}
              <p className="text-xs text-slate-400 mt-1">
                Find the UTR/Transaction ID on your UPI app&apos;s payment success screen
              </p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 flex gap-3 items-start">
              <span className="text-lg mt-0.5">⚠️</span>
              <p className="text-yellow-800 text-sm">
                Your order will be confirmed only <strong>after the admin verifies your payment</strong>.
                You&apos;ll see the status update on the next screen.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3.5 rounded-xl transition-colors"
              >
                ← Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-[2] bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-bold py-3.5 rounded-xl transition-colors"
              >
                {loading ? "Submitting..." : "Submit Payment & Place Order"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

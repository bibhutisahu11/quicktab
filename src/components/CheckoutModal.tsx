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
  menuItems?: { id: string; category: string }[];   // needed for category-scoped discounts
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
    paidAmount?: number,
    parcelCharge?: number,
    paymentMethod?: "UPI" | "CASH",
  ) => Promise<void>;
  isParcel: boolean;
  orgUpiId: string | null;
  orgSlug?: string;
  isDiningCustomer?: boolean;
}

/**
 * Comprehensive UTR / Transaction ID validator
 * Based on publicly documented Indian payment system formats:
 *
 * IMPS / UPI RRN   : exactly 12 digits  (e.g. 407812345678)
 * NEFT UTR         : 16 alphanumeric, starts with 4-letter bank code
 *                    (e.g. HDFC0123456789012, SBIN0123456789012)
 * RTGS UTR         : 16 alphanumeric, same pattern as NEFT
 * UPI Ref (Paytm)  : starts with 'T' + digits (e.g. T2506041234567890)
 * UPI Ref (PhonePe): alphanumeric, 12-16 chars (e.g. P2506041234)
 * UPI Ref (GPay)   : 12-digit numeric
 * Bank UPI refs    : 12-22 alphanumeric
 */
function validateUtr(utr: string): string | null {
  const t = utr.trim().toUpperCase();

  if (!t) return "UTR / Transaction ID is required";

  // Must be strictly alphanumeric — no spaces, hyphens, dots etc.
  if (!/^[A-Z0-9]+$/.test(t))
    return "UTR must contain only letters and numbers (no spaces or special characters)";

  if (t.length < 6)  return "UTR too short — minimum 6 characters";
  if (t.length > 22) return "UTR too long — maximum 22 characters";

  // Reject all-same character (e.g. 000000000000 or AAAAAAAAAAAA)
  if (/^(.)\1+$/.test(t))
    return "Invalid UTR — looks like a test/dummy value";

  // Reject simple ascending sequences (123456789012)
  const digits = t.replace(/\D/g, "");
  if (digits.length >= 6) {
    let ascending = true, descending = true;
    for (let i = 1; i < digits.length; i++) {
      if (+digits[i] !== +digits[i - 1] + 1) ascending = false;
      if (+digits[i] !== +digits[i - 1] - 1) descending = false;
    }
    if (ascending || descending)
      return "Invalid UTR — sequential numbers are not valid transaction IDs";
  }

  // Format-specific validations
  // IMPS / UPI RRN: exactly 12 digits
  if (/^\d{12}$/.test(t)) return null;

  // NEFT / RTGS: 16 chars, first 4 are uppercase alpha (bank IFSC prefix)
  if (/^[A-Z]{4}\d{12}$/.test(t) || /^[A-Z]{4}[A-Z0-9]{12}$/.test(t)) return null;

  // Paytm UPI: starts with T + 16+ digits
  if (/^T\d{10,}$/.test(t)) return null;

  // PhonePe: starts with P + alphanumeric
  if (/^P[A-Z0-9]{8,}$/.test(t)) return null;

  // General UPI / bank refs: 12-22 alphanumeric (catch-all for other banks)
  if (t.length >= 12 && t.length <= 22) return null;

  return "Invalid UTR format — please copy the exact transaction ID from your UPI app";
}

/** Check that the paid amount matches the order total (±₹1 tolerance for rounding) */
function validatePaidAmount(paid: string, expected: number): string | null {
  if (!paid.trim()) return "Please enter the amount you paid";
  const n = parseFloat(paid.replace(/,/g, "").trim());
  if (isNaN(n) || n <= 0) return "Enter a valid amount";
  if (Math.abs(n - expected) > 1)
    return `Amount mismatch! You entered ₹${n.toFixed(2)} but the order total is ₹${expected.toFixed(2)}. Please pay the exact amount.`;
  return null;
}

const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024; // 5 MB

// Categories that attract ₹5 parcel charge; everything else gets ₹10
const SNACK_CATEGORIES = new Set([
  "Evening Snacks",
  "Breakfast Delights",
  "Beverages",
]);

function calcParcelCharge(cart: import("@/types").CartItem[], menuItems: { id: string; category: string }[]): number {
  if (cart.length === 0) return 0;
  const catMap = Object.fromEntries(menuItems.map((m) => [m.id, m.category]));
  const allSnacks = cart.every((item) => SNACK_CATEGORIES.has(catMap[item.menuItemId] ?? ""));
  return allSnacks ? 5 : 10;
}

export default function CheckoutModal({
  open,
  onClose,
  cart,
  menuItems = [],
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

  /* ── payment method ── */
  const [paymentMethod, setPaymentMethod] = useState<"UPI" | "CASH">("UPI");

  /* ── step 2 (payment) fields ── */
  const [upiUtr, setUpiUtr]               = useState("");
  const [utrError, setUtrError]           = useState("");
  const [utrFraud, setUtrFraud]           = useState(false);
  const [utrChecking, setUtrChecking]     = useState(false);
  const [paidAmount, setPaidAmount]       = useState("");
  const [paidAmountError, setPaidAmountError] = useState("");
  const [screenshot, setScreenshot]       = useState<string | null>(null);
  const [screenshotName, setScreenshotName] = useState("");
  const [screenshotError, setScreenshotError] = useState("");
  const [upiQrDataUrl, setUpiQrDataUrl]   = useState<string | null>(null);
  const [upiDeepLink, setUpiDeepLink]     = useState<string>("");
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

  /* ── Offer reveal: show after phone is entered ── */
  const [offerRevealed, setOfferRevealed] = useState(false);
  const [showOfferBanner, setShowOfferBanner] = useState(false);

  function handlePhoneChange(val: string) {
    setPhone(val);
    setPhoneError("");
    // Reveal offer once phone has 10 digits
    if (!offerRevealed && val.replace(/\D/g, "").length >= 10) {
      setOfferRevealed(true);
      setShowOfferBanner(true);
    }
  }

  /* ── shared ── */
  const [step, setStep]     = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  // Build category map so CATEGORY-scoped discounts only apply to eligible items
  const categoryMap = Object.fromEntries(menuItems.map((m) => [m.id, m.category]));
  const appliedDiscounts: AppliedDiscount[] = applyDiscounts(discounts, cart, subtotal, categoryMap);
  const discountAmount = totalDiscount(appliedDiscounts);
  // Parcel charge — only for parcel orders, non-removable by customer
  const parcelCharge = isParcel ? calcParcelCharge(cart, menuItems) : 0;
  const total = Math.max(0, subtotal - discountAmount + parcelCharge);
  const requirePayment = true; // UPI payment is always required

  /* ── UPI QR generation (runs when payment step is shown) ── */
  useEffect(() => {
    if (step !== 2) return;
    if (!orgUpiId) return;
    const upiUri = `upi://pay?pa=${encodeURIComponent(orgUpiId)}&am=${total.toFixed(2)}&cu=INR&tn=${encodeURIComponent("Food order")}`;
    setUpiDeepLink(upiUri);
    QRCode.toDataURL(upiUri, { width: 260, margin: 1, color: { dark: "#1e293b", light: "#ffffff" } })
      .then(setUpiQrDataUrl)
      .catch(() => setUpiQrDataUrl(null));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, orgUpiId, total]);

  if (!open) return null;

  /* ── helpers ── */
  function resetAndClose() {
    setName(""); setPhone(""); setEmail(""); setBirthday(""); setAddress(""); setNotes("");
    setPaymentMethod("UPI");
    setUpiUtr(""); setUtrError(""); setUtrFraud(false); setUtrChecking(false);
    setPaidAmount(""); setPaidAmountError("");
    setScreenshot(null); setScreenshotName(""); setScreenshotError("");
    setUpiQrDataUrl(null);
    setOfferRevealed(false); setShowOfferBanner(false);
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
      setScreenshotError("Image too large — max 5 MB");
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
    // Cash: skip payment step, go straight to order submission
    if (paymentMethod === "CASH") {
      submitOrder();
    } else {
      setStep(2);
    }
  }

  /* ── real-time UTR duplicate check ── */
  async function checkUtrFraud(utr: string) {
    const trimmed = utr.trim();
    if (!trimmed || trimmed.length < 6) return;
    setUtrChecking(true);
    try {
      const res = await fetch(`/api/public/check-utr?utr=${encodeURIComponent(trimmed)}&orgSlug=${encodeURIComponent(orgSlug ?? "")}`);
      const data = res.ok ? await res.json() : { isDuplicate: false };
      setUtrFraud(data.isDuplicate);
      if (data.isDuplicate) {
        setUtrError("⚠️ This UTR has already been used. Please use a new transaction.");
      }
    } catch { /* ignore */ }
    finally { setUtrChecking(false); }
  }

  /* ── step 2 → submit ── */
  function handleStep2Submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    // Amount check first
    const amtErr = validatePaidAmount(paidAmount, total);
    if (amtErr) { setPaidAmountError(amtErr); return; }
    // UTR checks
    if (utrFraud) { setUtrError("⚠️ This UTR has already been used. Please make a new payment."); return; }
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
        paymentMethod === "UPI" ? upiUtr.trim() : undefined,
        paymentMethod === "UPI" ? screenshot ?? undefined : undefined,
        discountAmount > 0 ? discountAmount : undefined,
        paymentMethod === "UPI" ? parseFloat(paidAmount) : undefined,
        parcelCharge > 0 ? parcelCharge : undefined,
        paymentMethod,
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  /* ── shared form section helpers ── */
  const inputCls = (err?: string) =>
    `w-full border rounded-lg px-4 py-2.5 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent ${err ? "border-red-400 bg-red-50" : "border-slate-300"}`;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={resetAndClose} />
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            {paymentMethod === "UPI" ? (
              <div className="flex items-center gap-1 text-xs">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${step === 1 ? "bg-amber-500 text-white" : "bg-green-500 text-white"}`}>
                  {step === 1 ? "1" : "✓"}
                </span>
                <span className={`text-xs font-medium ${step === 1 ? "text-amber-600" : "text-green-600"}`}>Details</span>
                <span className="text-slate-300 mx-1">→</span>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${step === 2 ? "bg-amber-500 text-white" : "bg-slate-200 text-slate-500"}`}>2</span>
                <span className={`text-xs font-medium ${step === 2 ? "text-amber-600" : "text-slate-400"}`}>UPI Payment</span>
              </div>
            ) : (
              <h2 className="text-base font-bold text-slate-800">
                {isParcel ? "📦 Parcel Order" : "🍽️ Table Order"} · 💵 Cash
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
              {(appliedDiscounts.length > 0 || parcelCharge > 0) && (
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
                  {parcelCharge > 0 && (
                    <div className="flex justify-between text-sm text-orange-700 font-medium">
                      <span className="flex items-center gap-1">
                        📦 Parcel Charge
                        <span className="text-xs text-orange-500">
                          ({parcelCharge === 5 ? "Snacks" : "Food items"})
                        </span>
                      </span>
                      <span>+₹{parcelCharge.toFixed(0)}</span>
                    </div>
                  )}
                </>
              )}
              {parcelCharge > 0 && appliedDiscounts.length === 0 && (
                <div className="border-t border-slate-200 pt-2 flex justify-between text-sm text-orange-700 font-medium">
                  <span className="flex items-center gap-1">
                    📦 Parcel Charge
                    <span className="text-xs text-orange-500">
                      ({parcelCharge === 5 ? "Snacks" : "Food items"})
                    </span>
                  </span>
                  <span>+₹{parcelCharge.toFixed(0)}</span>
                </div>
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
                onChange={(e) => handlePhoneChange(e.target.value)}
                onBlur={() => setPhoneError(validatePhone(phone) ?? "")}
                required={isParcel}
                className={inputCls(phoneError)}
                placeholder="+91 98765 43210"
              />
              {phoneError && <p className="text-red-500 text-xs mt-1">{phoneError}</p>}
            </div>

            {/* 🎉 Surprise offer reveal after phone entry */}
            {showOfferBanner && (
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl px-4 py-4 shadow-lg animate-pulse-once">
                <div className="flex items-start gap-3">
                  <span className="text-3xl">🎉</span>
                  <div className="flex-1">
                    <p className="text-white font-black text-base">You unlocked a special offer!</p>
                    <p className="text-green-100 text-sm mt-1 font-medium">
                      Flat <strong className="text-white text-lg">20% OFF</strong> on all Biryani, Chinese, Noodles, Fried Rice &amp; Soups in your cart!
                    </p>
                    {discountAmount > 0 ? (
                      <div className="mt-2 bg-white/20 rounded-xl px-3 py-2 flex items-center gap-2">
                        <span className="text-white text-sm font-bold">💰 You save ₹{discountAmount.toFixed(0)} on this order!</span>
                      </div>
                    ) : (
                      <p className="text-green-200 text-xs mt-2">
                        Add any Biryani, Chinese or Soup item to avail this offer 👆
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowOfferBanner(false)}
                    className="text-green-200 hover:text-white text-lg leading-none"
                  >✕</button>
                </div>
              </div>
            )}

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
                  className="w-full border border-slate-300 rounded-lg px-4 py-2.5 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
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
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                placeholder="Any allergies or special requests..."
              />
            </div>

            {/* Payment method chooser */}
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Payment Method</p>
              <div className="grid grid-cols-2 gap-3">
                {(["UPI", "CASH"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMethod(m)}
                    className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 font-semibold transition-all ${
                      paymentMethod === m
                        ? m === "UPI"
                          ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                          : "border-green-500 bg-green-50 text-green-700"
                        : "border-slate-200 text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    <span className="text-2xl">{m === "UPI" ? "📲" : "💵"}</span>
                    <span className="text-sm">{m === "UPI" ? "UPI / QR" : "Cash"}</span>
                    {m === "CASH" && <span className="text-xs text-slate-400 font-normal">Admin will collect</span>}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className={`w-full text-white font-bold py-4 rounded-xl text-lg transition-colors ${
                paymentMethod === "CASH"
                  ? "bg-green-500 hover:bg-green-600"
                  : "bg-amber-500 hover:bg-amber-600"
              }`}
            >
              {paymentMethod === "CASH"
                ? `Place Order · ₹${total.toFixed(2)} (Cash)`
                : `Proceed to Pay · ₹${total.toFixed(2)} →`}
            </button>
          </form>
        )}

        {/* ── STEP 2: UPI not configured warning ── */}
        {step === 2 && !orgUpiId && (
          <div className="px-5 py-10 flex flex-col items-center gap-4 text-center">
            <div className="text-5xl">⚙️</div>
            <h3 className="text-lg font-bold text-slate-800">UPI Payment Not Configured</h3>
            <p className="text-slate-500 text-sm max-w-xs">
              The restaurant has not set up a UPI ID yet. Please ask the staff to configure it in the admin settings before placing an order.
            </p>
            <button type="button" onClick={resetAndClose} className="mt-2 px-6 py-2 bg-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-300">
              Close
            </button>
          </div>
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
                  <p className="text-xs text-slate-500">Scan with any UPI app — PhonePe, GPay, Paytm, etc.</p>
                </div>
              ) : (
                <div className="flex items-center justify-center h-32 text-slate-400 text-sm">Generating QR…</div>
              )}

              {/* Amount pill */}
              <div className="bg-amber-500 text-white rounded-xl py-3 px-5 inline-block mx-auto">
                <p className="font-black text-xl">₹{total.toFixed(2)}</p>
                <p className="text-amber-100 text-xs">Amount to pay</p>
              </div>

              {/* Manual UPI ID — tap to copy */}
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(orgUpiId!).then(() => alert("UPI ID copied!"))}
                className="w-full bg-white rounded-xl py-3 px-5 border border-indigo-100 text-center hover:bg-indigo-50 active:scale-95 transition-all"
                title="Tap to copy UPI ID"
              >
                <p className="text-xs text-slate-400 mb-1">Or pay manually to UPI ID &nbsp;📋</p>
                <p className="text-lg font-black text-slate-800 tracking-tight">{orgUpiId}</p>
                <p className="text-xs text-indigo-400 mt-0.5">Tap to copy</p>
              </button>

              <div className="text-left bg-white rounded-xl p-4 border border-indigo-100 space-y-1.5 text-sm text-slate-600">
                <p className="font-semibold text-slate-700">📋 Steps:</p>
                <p>1. Open PhonePe / GPay / Paytm and scan the QR above</p>
                <p>2. Pay <strong>₹{total.toFixed(2)}</strong> — amount auto-filled when scanned</p>
                <p>3. Take a <strong>live photo</strong> of the payment success screen</p>
                <p>4. Upload the photo &amp; paste the UTR number below</p>
              </div>
            </div>

            {/* ── Amount paid confirmation ── */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Amount Paid (₹) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₹</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={paidAmount}
                  onChange={(e) => { setPaidAmount(e.target.value); setPaidAmountError(""); }}
                  onBlur={() => setPaidAmountError(validatePaidAmount(paidAmount, total) ?? "")}
                  className={`w-full border rounded-lg pl-8 pr-4 py-2.5 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-lg font-bold ${paidAmountError ? "border-red-400 bg-red-50" : "border-slate-300"}`}
                  placeholder={total.toFixed(2)}
                  step="0.01"
                  min="0"
                />
              </div>
              {paidAmountError ? (
                <div className="mt-2 bg-red-50 border border-red-300 rounded-xl px-4 py-3 flex items-start gap-3">
                  <span className="text-xl mt-0.5">❌</span>
                  <p className="text-red-700 text-sm font-medium">{paidAmountError}</p>
                </div>
              ) : paidAmount && !validatePaidAmount(paidAmount, total) ? (
                <p className="text-green-600 text-xs mt-1 font-medium">✅ Amount matches — great!</p>
              ) : (
                <p className="text-xs text-slate-400 mt-1">
                  Must exactly match the order total of <strong>₹{total.toFixed(2)}</strong>
                </p>
              )}
            </div>

            {/* Screenshot upload */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Payment Screenshot <span className="text-red-500">*</span>
              </label>
              {/* capture="environment" opens rear camera directly, no gallery access */}
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
                  <span className="text-3xl">📷</span>
                  <span className="text-sm font-medium text-slate-600">Take a live photo of payment screen</span>
                  <span className="text-xs text-slate-400">Opens camera directly — max 5 MB</span>
                </button>
              )}
              {screenshotError && <p className="text-red-500 text-xs mt-1">{screenshotError}</p>}
            </div>

            {/* UTR input */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Paste UTR / Transaction ID <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={upiUtr}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    setUpiUtr(val);
                    setUtrError("");
                    setUtrFraud(false);
                  }}
                  onBlur={() => {
                    const fmt = validateUtr(upiUtr);
                    if (fmt) { setUtrError(fmt); return; }
                    checkUtrFraud(upiUtr);
                  }}
                  className={inputCls(utrError || utrFraud ? "err" : "")}
                  placeholder="e.g. 407812345678 or T2506041234"
                  maxLength={22}
                  autoCapitalize="characters"
                />
                {utrChecking && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs animate-pulse">
                    Checking…
                  </span>
                )}
              </div>

              {/* Fraud alert */}
              {utrFraud && (
                <div className="mt-2 bg-red-50 border border-red-300 rounded-xl px-4 py-3 flex items-start gap-3">
                  <span className="text-2xl mt-0.5">🚨</span>
                  <div>
                    <p className="text-red-700 font-bold text-sm">Fraud Detected!</p>
                    <p className="text-red-600 text-xs mt-0.5">
                      This UTR / Transaction ID has <strong>already been used</strong> for a previous order.
                      Please make a <strong>new payment</strong> from your UPI app and enter the new UTR.
                    </p>
                  </div>
                </div>
              )}

              {utrError && !utrFraud && <p className="text-red-500 text-xs mt-1">{utrError}</p>}
              {!utrError && !utrFraud && (
                <p className="text-xs text-slate-400 mt-1">
                  Copy &amp; paste the UTR / Transaction ID from your UPI app&apos;s payment success screen
                </p>
              )}
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
                  disabled={loading || utrFraud || utrChecking || !!paidAmountError}
                className="flex-[2] bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white font-bold py-3.5 rounded-xl transition-colors"
              >
                {utrChecking ? "Verifying UTR…" : utrFraud ? "🚨 Invalid UTR" : loading ? "Submitting..." : "Submit Payment & Place Order"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

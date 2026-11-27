"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";

// ── First-login-of-day messages (English) ────────────────────────────────────
const LOGIN_MESSAGES = [
  "Ready to serve amazing food today? Let's go! 🚀",
  "Your restaurant awaits — let's make today great!",
  "Have a productive and smooth shift today!",
  "Wishing you a busy (in the best way!) day.",
  "Good things are coming. Let's get started!",
];

// ── Inactivity return messages (Hindi / Odia mix) ────────────────────────────
const RETURN_MESSAGES = [
  { line1: "Aaila bapa! 👀",           line2: "Hope sabhi transactions update ho gayi hain! 🧾" },
  { line1: "Kana, bhai? Firiki aasila! 😄", line2: "Sab bills theek achhi toh? Missing kichhi nei toh?" },
  { line1: "Aa gaye Maharaj! 🙏",      line2: "Umeed hai sare transactions darz ho gaye hain!" },
  { line1: "Oho! Feri asila! 🎉",      line2: "Sab entries update kari dela ni? Check kariba!" },
  { line1: "Wapas aa gaye boss! 💼",   line2: "Koi bhi transaction miss mat karna — ledger saaf rakhna! 📒" },
  { line1: "Kana, bhai! Mone achi toh? 😅", line2: "Lunch / dinner attendance mark karile ni aaji?" },
  { line1: "Aye haaye, aa gaye! 😂",   line2: "Bills, expenses — sab update hai na bhai?" },
  { line1: "Namaste puni! 🙏",         line2: "Hope tume sabi transaction sesh karichi!" },
];

const INACTIVITY_MS = 15 * 60 * 1000; // 15 minutes

function getGreeting() {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return { text: "Good Morning",   emoji: "☀️" };
  if (h >= 12 && h < 17) return { text: "Good Afternoon", emoji: "🌤️" };
  return                         { text: "Good Evening",   emoji: "🌙" };
}

interface Toast {
  type: "login" | "return";
  line1: string;
  line2: string;
}

export default function WelcomeToast() {
  const { data: session } = useSession();
  const [toast, setToast]       = useState<Toast | null>(null);
  const [exiting, setExiting]   = useState(false);
  const hiddenAtRef             = useRef<number | null>(null);
  const timerRef                = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── First-login-of-day toast ──────────────────────────────────────────────
  useEffect(() => {
    if (!session?.user) return;
    const key = `welcome_shown_${session.user.email}_${new Date().toDateString()}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");

    const { text: greetText, emoji } = getGreeting();
    const name = session.user.name?.split(" ")[0] ?? "there";
    const msg  = LOGIN_MESSAGES[Math.floor(Math.random() * LOGIN_MESSAGES.length)];

    setTimeout(() => setToast({
      type: "login",
      line1: `${emoji} ${greetText}, ${name}! 👋`,
      line2: msg,
    }), 500);
  }, [session]);

  // ── Inactivity return toast ───────────────────────────────────────────────
  useEffect(() => {
    if (!session?.user) return;

    function handleVisibilityChange() {
      if (document.hidden) {
        hiddenAtRef.current = Date.now();
      } else {
        if (hiddenAtRef.current && Date.now() - hiddenAtRef.current >= INACTIVITY_MS) {
          const name = session!.user!.name?.split(" ")[0] ?? "bhai";
          const pick = RETURN_MESSAGES[Math.floor(Math.random() * RETURN_MESSAGES.length)];
          setExiting(false);
          setToast({
            type: "return",
            line1: pick.line1.replace("bhai", name),
            line2: pick.line2,
          });
        }
        hiddenAtRef.current = null;
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [session]);

  // ── Auto-dismiss after 7 seconds ─────────────────────────────────────────
  useEffect(() => {
    if (!toast) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(dismiss, 7000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [toast]);

  function dismiss() {
    setExiting(true);
    setTimeout(() => { setToast(null); setExiting(false); }, 300);
  }

  if (!toast || !session?.user) return null;

  const isReturn = toast.type === "return";

  return (
    <div
      className={`fixed top-20 right-4 z-[200] w-80 bg-white rounded-2xl shadow-2xl border overflow-hidden transition-all duration-300 ${
        exiting ? "opacity-0 translate-x-8" : "opacity-100 translate-x-0"
      } ${isReturn ? "border-amber-200" : "border-slate-100"}`}
    >
      {/* Progress bar */}
      <div className={`h-1 ${isReturn ? "bg-orange-400" : "bg-amber-500"} animate-[shrink_7s_linear_forwards]`}
        style={{ transformOrigin: "left" }} />

      <div className="p-5">
        <div className="flex items-start gap-3">
          <div className="text-3xl flex-shrink-0">{isReturn ? "👋" : "✨"}</div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-800 text-base leading-snug">{toast.line1}</p>
            <p className="text-slate-500 text-sm mt-1.5 leading-relaxed">{toast.line2}</p>
          </div>
          <button onClick={dismiss}
            className="text-slate-300 hover:text-slate-500 flex-shrink-0 text-xl leading-none mt-0.5">×</button>
        </div>
      </div>
    </div>
  );
}

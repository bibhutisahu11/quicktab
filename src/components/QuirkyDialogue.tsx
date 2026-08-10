"use client";

import { useEffect, useState } from "react";
import { QUIRKY_DIALOGUES } from "@/lib/upsellEngine";

/**
 * Randomly shows a quirky Odia/Hindi/English dialogue as a
 * speech-bubble toast from the bottom-left of the screen.
 * Appears every ~20 seconds, visible for 6 seconds.
 */
export default function QuirkyDialogue() {
  const [current, setCurrent] = useState<typeof QUIRKY_DIALOGUES[0] | null>(null);
  const [visible, setVisible] = useState(false);
  const [usedIndices, setUsedIndices] = useState<Set<number>>(new Set());

  function showNext() {
    let idx: number;
    let available = QUIRKY_DIALOGUES.map((_, i) => i).filter((i) => !usedIndices.has(i));
    if (available.length === 0) {
      setUsedIndices(new Set());
      available = QUIRKY_DIALOGUES.map((_, i) => i);
    }
    idx = available[Math.floor(Math.random() * available.length)];
    setUsedIndices((prev) => new Set([...prev, idx]));
    setCurrent(QUIRKY_DIALOGUES[idx]);
    setVisible(true);

    // Hide after 6 seconds
    setTimeout(() => setVisible(false), 6000);
  }

  useEffect(() => {
    // First appearance after 8 seconds
    const first = setTimeout(showNext, 8000);
    // Then every 22 seconds
    const interval = setInterval(showNext, 22000);
    return () => { clearTimeout(first); clearInterval(interval); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!current) return null;

  return (
    <div
      className={`fixed bottom-28 left-3 z-40 max-w-[260px] transition-all duration-500 ${
        visible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-3 scale-95 pointer-events-none"
      }`}
    >
      {/* Speech bubble */}
      <div className="bg-white rounded-2xl rounded-bl-sm shadow-xl border border-amber-200 px-4 py-3 relative">
        {/* Main dialogue */}
        <p className="text-slate-800 font-bold text-sm leading-snug">{current.text}</p>

        {/* Subtext */}
        <p className="text-slate-500 text-xs mt-1 leading-snug">{current.subtext}</p>

        {/* Speech bubble tail */}
        <div className="absolute -bottom-2 left-4 w-4 h-4 bg-white border-r border-b border-amber-200 rotate-45" />
      </div>

      {/* Mascot / chef emoji */}
      <div className="mt-2 flex items-center gap-1.5 pl-1">
        <span className="text-2xl">👨‍🍳</span>
        <span className="text-xs text-slate-400 font-medium">Kalinga Bites Chef</span>
      </div>
    </div>
  );
}

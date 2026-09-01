"use client";

import { useRef, useEffect, KeyboardEvent } from "react";

export interface Suggestion {
  id: string;
  primary: string;    // bold label
  secondary?: string; // small pill (category, role, etc.)
  meta?: string;      // right-aligned text (price, amount, etc.)
  badge?: string;     // small inline badge (e.g. cart qty "×2")
}

interface Props {
  suggestions: Suggestion[];
  activeIdx: number;
  onSelect: (s: Suggestion) => void;
}

/**
 * Floating suggestion list rendered absolutely below a search input.
 * The parent must wrap the input + this component in a `relative` container.
 */
export default function SuggestionDropdown({ suggestions, activeIdx, onSelect }: Props) {
  const listRef = useRef<HTMLDivElement>(null);

  // Keep highlighted item scrolled into view
  useEffect(() => {
    if (activeIdx < 0 || !listRef.current) return;
    const el = listRef.current.children[activeIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  if (!suggestions.length) return null;

  return (
    <div
      ref={listRef}
      className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden max-h-64 overflow-y-auto"
    >
      {suggestions.map((s, idx) => (
        <button
          key={s.id}
          type="button"
          onMouseDown={(e) => { e.preventDefault(); onSelect(s); }}
          className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors gap-2 ${
            idx === activeIdx ? "bg-amber-50" : "hover:bg-slate-50"
          }`}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-sm font-semibold text-slate-800 truncate">{s.primary}</span>
            {s.secondary && (
              <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full flex-shrink-0">
                {s.secondary}
              </span>
            )}
            {s.badge && (
              <span className="text-xs text-amber-600 font-bold flex-shrink-0">{s.badge}</span>
            )}
          </div>
          {s.meta && (
            <span className="text-xs font-bold text-slate-500 flex-shrink-0">{s.meta}</span>
          )}
        </button>
      ))}
    </div>
  );
}

/**
 * Keyboard handler to attach to a search input's onKeyDown.
 * Returns the new activeIdx.
 */
export function handleSuggestionKey(
  e: KeyboardEvent<HTMLInputElement>,
  count: number,
  activeIdx: number,
  setActiveIdx: (n: number) => void,
  onAccept: (idx: number) => void,
  onClear: () => void,
) {
  if (!count) return;
  if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(Math.min(activeIdx + 1, count - 1)); }
  else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx(Math.max(activeIdx - 1, 0)); }
  else if (e.key === "Enter" && activeIdx >= 0) { e.preventDefault(); onAccept(activeIdx); }
  else if (e.key === "Escape") { onClear(); }
}

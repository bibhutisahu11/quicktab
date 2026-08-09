"use client";

import { useEffect, useState } from "react";

interface UpsellToastProps {
  itemName: string;          // item just added
  emoji: string;
  message: string;           // pairing message
  suggestedItem: { id: string; name: string; price: number } | null;
  onAddSuggested: (itemId: string) => void;
  onDismiss: () => void;
}

export default function UpsellToast({
  itemName,
  emoji,
  message,
  suggestedItem,
  onAddSuggested,
  onDismiss,
}: UpsellToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Slide-in animation
    const t1 = setTimeout(() => setVisible(true), 50);
    // Auto-dismiss after 5 seconds
    const t2 = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300);
    }, 5000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDismiss]);

  function handleAdd() {
    if (suggestedItem) onAddSuggested(suggestedItem.id);
    setVisible(false);
    setTimeout(onDismiss, 300);
  }

  function handleClose() {
    setVisible(false);
    setTimeout(onDismiss, 300);
  }

  return (
    <div
      className={`fixed bottom-24 left-1/2 z-50 w-[92vw] max-w-sm transition-all duration-300 ${
        visible ? "-translate-x-1/2 translate-y-0 opacity-100" : "-translate-x-1/2 translate-y-4 opacity-0"
      }`}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-amber-200 overflow-hidden">
        {/* Added confirmation row */}
        <div className="bg-green-500 px-4 py-2 flex items-center gap-2">
          <span className="text-white text-sm font-bold">✓ Added to cart:</span>
          <span className="text-green-100 text-sm truncate">{itemName}</span>
        </div>

        {/* Upsell suggestion */}
        {suggestedItem && (
          <div className="px-4 py-3">
            <p className="text-slate-700 text-sm font-medium leading-snug">
              {emoji} {message}
            </p>
            <div className="mt-2.5 flex items-center justify-between gap-3">
              <div>
                <p className="font-bold text-slate-800 text-sm">{suggestedItem.name}</p>
                <p className="text-amber-600 font-bold text-sm">₹{suggestedItem.price}</p>
              </div>
              <button
                onClick={handleAdd}
                className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors whitespace-nowrap"
              >
                + Add
              </button>
            </div>
          </div>
        )}

        {/* Progress bar */}
        <div className="h-1 bg-amber-100">
          <div
            className="h-1 bg-amber-400 transition-all"
            style={{ animation: "upsell-shrink 5s linear forwards" }}
          />
        </div>
      </div>

      {/* Close button */}
      <button
        onClick={handleClose}
        className="absolute -top-2 -right-2 w-6 h-6 bg-slate-500 text-white rounded-full text-xs flex items-center justify-center shadow-md hover:bg-slate-700"
      >
        ✕
      </button>

      <style jsx>{`
        @keyframes upsell-shrink {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>
    </div>
  );
}

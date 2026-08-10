"use client";

import { CartItem, MenuItemData, formatQty } from "@/types";

interface CartDrawerProps {
  cart: CartItem[];
  menuItems?: MenuItemData[];
  onAdd: (itemId: string) => void;
  onRemove: (itemId: string) => void;
  onCheckout: () => void;
  open: boolean;
  onClose: () => void;
}

export default function CartDrawer({
  cart,
  menuItems = [],
  onAdd,
  onRemove,
  onCheckout,
  open,
  onClose,
}: CartDrawerProps) {
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      {/* Sheet — pinned to bottom, never taller than 85dvh, footer always visible */}
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl flex flex-col"
           style={{ maxHeight: "min(85dvh, 85vh)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <h2 className="text-xl font-bold text-slate-800">
            Your Order ({itemCount} item{itemCount !== 1 ? "s" : ""})
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"
          >
            ✕
          </button>
        </div>

        {/* Scrollable item list — flex-1 takes leftover space between header and footer */}
        <div className="overflow-y-auto flex-1 px-5 py-3 space-y-3 overscroll-contain">
          {cart.map((item) => {
            const menuItem = menuItems.find((m) => m.id === item.menuItemId);
            const unit = menuItem?.unit ?? null;
            return (
              <div key={item.menuItemId} className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800 truncate">{item.name}</p>
                  <p className="text-slate-500 text-sm">
                    ₹{item.price.toFixed(0)}/{unit && unit !== "piece" ? unit : "pc"}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <button
                    onClick={() => onRemove(item.menuItemId)}
                    className="w-7 h-7 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-700 font-bold flex items-center justify-center transition-colors text-sm"
                  >
                    −
                  </button>
                  <span className="min-w-[32px] text-center font-semibold text-sm">
                    {formatQty(item.quantity, unit)}
                  </span>
                  <button
                    onClick={() => onAdd(item.menuItemId)}
                    className="w-7 h-7 bg-amber-500 hover:bg-amber-600 rounded-full text-white font-bold flex items-center justify-center transition-colors text-sm"
                  >
                    +
                  </button>
                  <span className="w-16 text-right font-semibold text-slate-800">
                    ₹{(item.price * item.quantity).toFixed(0)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer — always visible, never scrolls away */}
        <div className="flex-shrink-0 px-5 pt-4 pb-6 border-t border-slate-100 bg-white"
             style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom, 24px))" }}>
          <div className="flex justify-between items-center mb-4">
            <span className="text-lg font-semibold text-slate-700">Total</span>
            <span className="text-2xl font-bold text-amber-600">₹{total.toFixed(2)}</span>
          </div>
          <button
            onClick={onCheckout}
            className="w-full bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold py-4 rounded-xl text-lg transition-colors shadow-lg"
          >
            Proceed to Checkout →
          </button>
        </div>
      </div>
    </div>
  );
}

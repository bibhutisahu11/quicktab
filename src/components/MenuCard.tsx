"use client";

import { MenuItemData, CartItem, formatQty } from "@/types";

interface MenuCardProps {
  item: MenuItemData;
  cart: CartItem[];
  onAdd: (item: MenuItemData) => void;
  onRemove: (itemId: string) => void;
  orderCount?: number;
}

export default function MenuCard({ item, cart, onAdd, onRemove, orderCount = 0 }: MenuCardProps) {
  const cartItem = cart.find((c) => c.menuItemId === item.id);
  const qty = cartItem?.quantity ?? 0;

  const isHot        = orderCount >= 20;
  const isBestseller = orderCount >= 50;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col relative">

      {/* Social proof badge */}
      {isBestseller && (
        <div className="absolute top-0 right-0 z-10 bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 rounded-bl-lg">
          ⭐ BESTSELLER
        </div>
      )}
      {isHot && !isBestseller && (
        <div className="absolute top-0 right-0 z-10 bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-bl-lg">
          🔥 POPULAR
        </div>
      )}

      {/* Image / placeholder */}
      {item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.imageUrl} alt={item.name} className="w-full h-36 object-cover" />
      ) : (
        <div className="w-full h-36 bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
          <span className="text-4xl">
            {item.category.includes("Biryani") || item.category.includes("Dum") ? "🍛"
              : item.category.includes("Noodles") || item.category.includes("Rice") ? "🍜"
              : item.category.includes("Soup") ? "🍲"
              : item.category.includes("Momo") || item.category.includes("Roll") ? "🥟"
              : item.category.includes("Dosa") ? "🥞"
              : item.category.includes("Sweet") ? "🍮"
              : item.category.includes("Snack") || item.category.includes("Starter") ? "🍗"
              : item.category.includes("Breakfast") ? "☀️"
              : item.category.includes("Beverage") ? "🥤"
              : "🍽️"}
          </span>
        </div>
      )}

      <div className="p-3 flex flex-col flex-1">
        <h3 className="font-semibold text-slate-800 leading-tight text-sm">{item.name}</h3>
        {item.description && (
          <p className="text-slate-500 text-xs mt-0.5 flex-1 line-clamp-2">{item.description}</p>
        )}

        {/* Order count social proof */}
        {orderCount >= 5 && (
          <p className="text-xs mt-1 font-medium text-slate-400">
            {isHot ? "🔥" : "👥"} {orderCount}+ orders
          </p>
        )}

        {/* Price row */}
        <div className="mt-2 flex items-center justify-between gap-2">
          <div>
            <span className="text-base font-bold text-amber-600">₹{item.price.toFixed(0)}</span>
            {item.unit && item.unit !== "piece" && (
              <span className="text-xs text-slate-400 ml-1">/{item.unit}</span>
            )}
          </div>

          {qty === 0 ? (
            <button
              onClick={() => onAdd(item)}
              className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-1.5 rounded-full transition-colors"
            >
              {item.unit && item.unit !== "piece" ? `Add ${item.unit}` : "Add"}
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onRemove(item.id)}
                className="w-7 h-7 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-700 font-bold flex items-center justify-center transition-colors text-sm"
              >−</button>
              <span className="min-w-[28px] text-center font-semibold text-slate-800 text-sm">
                {formatQty(qty, item.unit)}
              </span>
              <button
                onClick={() => onAdd(item)}
                className="w-7 h-7 bg-amber-500 hover:bg-amber-600 rounded-full text-white font-bold flex items-center justify-center transition-colors text-sm"
              >+</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { MenuItemData, CartItem } from "@/types";
import MenuCard from "./MenuCard";
import CartDrawer from "./CartDrawer";
import CheckoutModal from "./CheckoutModal";
import UpsellToast from "./UpsellToast";
import { getUpsellSuggestion, FOOD_TIPS } from "@/lib/upsellEngine";

interface MenuPageProps {
  menuItems: MenuItemData[];
  tableToken?: string;
  tableName?: string;
  orgSlug?: string;
  orgName?: string;
  orgUpiId?: string | null;
}

// Map hour ranges to suggested category keywords and greeting info
function getTimeContext() {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return { greeting: "Good Morning",  emoji: "☀️",  keywords: ["breakfast", "morning", "snacks", "beverages", "tea", "coffee"] };
  if (h >= 12 && h < 16) return { greeting: "Good Afternoon", emoji: "🌤️", keywords: ["lunch", "main course", "rice", "meals", "thali"] };
  if (h >= 16 && h < 20) return { greeting: "Good Evening",  emoji: "🌇", keywords: ["snacks", "evening", "beverages", "starters", "chai"] };
  return                         { greeting: "Good Evening",  emoji: "🌙", keywords: ["dinner", "main course", "biryani", "rice", "starters"] };
}

function suggestedCategory(categories: string[], keywords: string[]): string | null {
  for (const kw of keywords) {
    const match = categories.find((c) => c.toLowerCase().includes(kw));
    if (match) return match;
  }
  return null;
}

interface LastOrder { items: CartItem[]; phone: string | null; savedAt: string; }

export default function MenuPage({ menuItems, tableToken, tableName, orgSlug, orgName, orgUpiId }: MenuPageProps) {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [showGreeting, setShowGreeting] = useState(true);
  const [lastOrder, setLastOrder] = useState<LastOrder | null>(null);
  const [showReorderBanner, setShowReorderBanner] = useState(false);
  const [isDiningCustomer, setIsDiningCustomer] = useState(false);

  // ── Popular items (social proof) ──────────────────────────────────────────
  const [popularMap, setPopularMap] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!orgSlug) return;
    fetch(`/api/public/popular-items?orgSlug=${orgSlug}`)
      .then((r) => r.ok ? r.json() : [])
      .then((data: { menuItemId: string; totalOrdered: number }[]) => {
        const map: Record<string, number> = {};
        data.forEach((d) => { if (d.menuItemId) map[d.menuItemId] = d.totalOrdered; });
        setPopularMap(map);
      })
      .catch(() => {});
  }, [orgSlug]);

  // ── Upsell toast ──────────────────────────────────────────────────────────
  const [upsellToast, setUpsellToast] = useState<{
    itemName: string; emoji: string; message: string;
    suggestedItem: { id: string; name: string; price: number } | null;
  } | null>(null);
  const upsellTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Rotating tip banner ───────────────────────────────────────────────────
  const [tipIndex, setTipIndex] = useState(() => Math.floor(Math.random() * FOOD_TIPS.length));
  const [tipVisible, setTipVisible] = useState(true);

  // Load previous order from localStorage, then confirm dining status via API using phone
  useEffect(() => {
    if (!orgSlug) return;
    try {
      const raw = localStorage.getItem(`lastOrder_${orgSlug}`);
      if (!raw) return;
      const parsed: LastOrder = JSON.parse(raw);
      const ageMs = Date.now() - new Date(parsed.savedAt).getTime();
      const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

      // Show reorder banner if within 30 days
      if (ageMs < THIRTY_DAYS && parsed.items.length > 0) {
        setLastOrder(parsed);
        setShowReorderBanner(true);
      }

      // Confirm dining status via server using stored phone number (most reliable)
      if (parsed.phone) {
        fetch(`/api/public/check-dining?phone=${encodeURIComponent(parsed.phone)}&orgSlug=${encodeURIComponent(orgSlug)}`)
          .then((r) => r.ok ? r.json() : { isDining: false })
          .then((data) => {
            if (data.isDining) setIsDiningCustomer(true);
          })
          .catch(() => {
            // Fallback: use 90-min localStorage window if API fails
            const NINETY_MIN = 90 * 60 * 1000;
            if (ageMs < NINETY_MIN) setIsDiningCustomer(true);
          });
      } else {
        // No phone stored — fall back to time window
        const NINETY_MIN = 90 * 60 * 1000;
        if (ageMs < NINETY_MIN) setIsDiningCustomer(true);
      }
    } catch { /* ignore */ }
  }, [orgSlug]);

  const handleReorder = useCallback(() => {
    if (!lastOrder) return;
    // Only add items that are still available on the current menu
    const availableIds = new Set(menuItems.filter((m) => m.available).map((m) => m.id));
    const validItems = lastOrder.items.filter((i) => availableIds.has(i.menuItemId));
    if (validItems.length > 0) setCart(validItems);
    setShowReorderBanner(false);
    setCartOpen(true);
  }, [lastOrder, menuItems]);

  // Rotate food tips every 6 seconds
  useEffect(() => {
    const t = setInterval(() => {
      setTipVisible(false);
      setTimeout(() => {
        setTipIndex((i) => (i + 1) % FOOD_TIPS.length);
        setTipVisible(true);
      }, 400);
    }, 6000);
    return () => clearInterval(t);
  }, []);

  const timeCtx = useMemo(() => getTimeContext(), []);

  const categories = useMemo(() => {
    const cats = Array.from(new Set(menuItems.map((i) => i.category))).sort();
    return cats;
  }, [menuItems]);

  // Pick a suggested category based on time-of-day
  const defaultCategory = useMemo(() => {
    const suggested = suggestedCategory(categories, timeCtx.keywords);
    return suggested ?? "All";
  }, [categories, timeCtx]);

  const [activeCategory, setActiveCategory] = useState<string>("All");

  // Apply time-based default once categories are known
  useEffect(() => {
    if (defaultCategory !== "All") setActiveCategory(defaultCategory);
  }, [defaultCategory]);

  const allCategories = useMemo(() => ["All", ...categories], [categories]);

  // Show available items first, unavailable at bottom with a "Sold Out" indicator
  const filtered = useMemo(() => {
    const pool =
      activeCategory === "All"
        ? menuItems
        : menuItems.filter((i) => i.category === activeCategory);
    const avail   = pool.filter((i) =>  i.available);
    const unavail = pool.filter((i) => !i.available);
    return [...avail, ...unavail];
  }, [menuItems, activeCategory]);

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  function addToCart(item: MenuItemData) {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItemId === item.id);
      const newCart = existing
        ? prev.map((c) => c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c)
        : [...prev, { menuItemId: item.id, name: item.name, price: item.price, quantity: 1 }];

      // Only show upsell on first add (not repeat increments)
      if (!existing) {
        if (upsellTimeoutRef.current) clearTimeout(upsellTimeoutRef.current);
        const cartIds = new Set(newCart.map((c) => c.menuItemId));
        const result = getUpsellSuggestion(item.category, menuItems, cartIds);
        if (result) {
          setUpsellToast({
            itemName: item.name,
            emoji: result.suggestion.emoji,
            message: result.suggestion.message,
            suggestedItem: result.item,
          });
        }
      }
      return newCart;
    });
  }

  function removeFromCart(itemId: string) {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItemId === itemId);
      if (!existing) return prev;
      if (existing.quantity === 1) return prev.filter((c) => c.menuItemId !== itemId);
      return prev.map((c) =>
        c.menuItemId === itemId ? { ...c, quantity: c.quantity - 1 } : c
      );
    });
  }

  function addByIdToCart(itemId: string) {
    const item = menuItems.find((m) => m.id === itemId);
    if (item) addToCart(item);
  }

  async function handlePlaceOrder(
    customerName: string,
    phone: string,
    notes: string,
    address: string,
    email: string,
    birthday: string,
    upiUtr?: string,
    paymentScreenshot?: string,
    discountAmount?: number,
  ) {
    // Save cart to localStorage for reorder (keyed by phone or anonymous)
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(`lastOrder_${orgSlug}`, JSON.stringify({
          items: cart,
          phone: phone || null,
          savedAt: new Date().toISOString(),
        }));
      } catch { /* ignore */ }
    }

    const body = {
      type: tableToken ? "TABLE" : "PARCEL",
      tableToken: tableToken ?? undefined,
      orgSlug: orgSlug ?? undefined,
      customerName,
      phone: phone || undefined,
      email: email || undefined,
      birthday: birthday || undefined,
      deliveryAddress: address || undefined,
      notes: notes || undefined,
      upiUtr: upiUtr || undefined,
      paymentScreenshot: paymentScreenshot || undefined,
      discountAmount: discountAmount ?? 0,
      items: cart.map((c) => ({ menuItemId: c.menuItemId, quantity: c.quantity })),
    };

    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Failed to place order");
    }

    const order = await res.json();
    router.push(`/order/${order.id}`);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">🍽️ Our Menu</h1>
            {tableName ? (
              <p className="text-amber-100 text-sm">Dine-in — {tableName}</p>
            ) : (
              <p className="text-amber-100 text-sm">Parcel / Takeaway Order</p>
            )}
          </div>
          {cartCount > 0 && (
            <button
              onClick={() => setCartOpen(true)}
              className="bg-white text-amber-600 font-bold rounded-full px-4 py-2 shadow flex items-center gap-2 text-sm"
            >
              🛒 {cartCount} · ₹{cartTotal.toFixed(0)}
            </button>
          )}
        </div>

        {/* Category tabs */}
        <div className="max-w-2xl mx-auto px-4 pb-3 flex gap-2 overflow-x-auto scrollbar-hide">
          {allCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                activeCategory === cat
                  ? "bg-white text-amber-600 shadow font-bold"
                  : "bg-amber-400/40 text-white"
              }`}
            >
              {cat}
              {cat === defaultCategory && cat !== "All" && (
                <span className="ml-1 text-xs opacity-75">✦</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Time-of-day greeting banner */}
      {showGreeting && (
        <div className="max-w-2xl mx-auto px-4 pt-4">
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl px-5 py-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{timeCtx.emoji}</span>
              <div>
                <p className="font-bold text-slate-800">{timeCtx.greeting}! 👋</p>
                <p className="text-sm text-slate-500">
                  {orgName ? `Welcome to ${orgName}` : "Welcome!"}
                  {defaultCategory !== "All" && <> · We suggest <span className="font-semibold text-amber-600">{defaultCategory}</span> right now</>}
                </p>
              </div>
            </div>
            <button onClick={() => setShowGreeting(false)} className="text-slate-300 hover:text-slate-500 text-xl leading-none flex-shrink-0 ml-3">×</button>
          </div>
        </div>
      )}

      {/* Priority dining banner */}
      {isDiningCustomer && (
        <div className="max-w-2xl mx-auto px-4 pt-3">
          <div className="bg-gradient-to-r from-amber-400 to-orange-400 rounded-2xl px-5 py-3.5 shadow-md flex items-center gap-3">
            <span className="text-3xl">🍽️</span>
            <div className="flex-1">
              <p className="font-black text-white text-sm">You&apos;re already dining with us!</p>
              <p className="text-amber-100 text-xs mt-0.5">
                We have <strong>prioritized your order</strong> as you are already dining. Eat slowly &amp; enjoy 😊🌟
              </p>
            </div>
            <span className="text-2xl">⭐</span>
          </div>
        </div>
      )}

      {/* Reorder banner */}
      {showReorderBanner && lastOrder && (
        <div className="max-w-2xl mx-auto px-4 pt-3">
          <div className="bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-200 rounded-2xl px-5 py-3 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔄</span>
              <div>
                <p className="font-bold text-slate-800 text-sm">Welcome back!</p>
                <p className="text-xs text-slate-500">
                  {lastOrder.items.length} item{lastOrder.items.length > 1 ? "s" : ""} from your last visit
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleReorder}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
              >
                Reorder
              </button>
              <button onClick={() => setShowReorderBanner(false)} className="text-slate-300 hover:text-slate-500 text-lg leading-none">×</button>
            </div>
          </div>
        </div>
      )}

      {/* Rotating food tip / upsell banner */}
      <div className="max-w-2xl mx-auto px-4 pt-3">
        <div
          className={`bg-gradient-to-r from-rose-50 to-orange-50 border border-rose-200 rounded-2xl px-4 py-3 transition-all duration-400 ${tipVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"}`}
        >
          <p className="text-slate-700 text-sm leading-snug">{FOOD_TIPS[tipIndex].text}</p>
          {FOOD_TIPS[tipIndex].cta && (() => {
            const ctaItem = menuItems.find((m) => m.available && m.name === FOOD_TIPS[tipIndex].cta);
            return ctaItem ? (
              <button
                onClick={() => addToCart(ctaItem)}
                className="mt-2 text-xs font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1 rounded-full transition-colors"
              >
                + Add {ctaItem.name} · ₹{ctaItem.price}
              </button>
            ) : null;
          })()}
        </div>
      </div>

      {/* Menu grid */}
      <div className="max-w-2xl mx-auto px-4 py-5">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <div className="text-5xl mb-3">🍽️</div>
            <p>No items in this category</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
              {filtered.filter((i) => i.available).map((item) => (
                <MenuCard
                  key={item.id}
                  item={item}
                  cart={cart}
                  onAdd={addToCart}
                  onRemove={removeFromCart}
                  orderCount={popularMap[item.id] ?? 0}
                />
              ))}
            </div>
            {/* Sold out items */}
            {filtered.some((i) => !i.available) && (
              <div className="mt-6">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <span className="flex-1 h-px bg-slate-200" />
                  Currently Unavailable
                  <span className="flex-1 h-px bg-slate-200" />
                </p>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 opacity-50">
                  {filtered.filter((i) => !i.available).map((item) => (
                    <div key={item.id} className="relative">
                      <MenuCard
                        item={item}
                        cart={cart}
                        onAdd={() => {}}
                        onRemove={() => {}}
                      />
                      <div className="absolute inset-0 bg-white/60 rounded-2xl flex items-center justify-center">
                        <span className="bg-slate-700 text-white text-xs font-bold px-3 py-1.5 rounded-full">Sold Out</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Floating cart button */}
      {cartCount > 0 && (
        <div className="fixed bottom-6 left-0 right-0 flex justify-center z-20 px-4">
          <button
            onClick={() => setCartOpen(true)}
            className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-8 py-4 rounded-2xl shadow-2xl text-base flex items-center gap-3 transition-colors"
          >
            <span className="bg-white text-amber-600 rounded-full w-7 h-7 flex items-center justify-center font-bold text-sm">
              {cartCount}
            </span>
            View Cart · ₹{cartTotal.toFixed(0)}
          </button>
        </div>
      )}

      <CartDrawer
        cart={cart}
        onAdd={addByIdToCart}
        onRemove={removeFromCart}
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        onCheckout={() => {
          setCartOpen(false);
          setCheckoutOpen(true);
        }}
      />

      <CheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        cart={cart}
        menuItems={menuItems}
        onPlaceOrder={handlePlaceOrder}
        isParcel={!tableToken}
        orgUpiId={orgUpiId ?? null}
        orgSlug={orgSlug}
        isDiningCustomer={isDiningCustomer}
      />

      {/* Upsell / cross-sell toast */}
      {upsellToast && !checkoutOpen && !cartOpen && (
        <UpsellToast
          itemName={upsellToast.itemName}
          emoji={upsellToast.emoji}
          message={upsellToast.message}
          suggestedItem={upsellToast.suggestedItem}
          onAddSuggested={(itemId) => {
            const item = menuItems.find((m) => m.id === itemId);
            if (item) addToCart(item);
          }}
          onDismiss={() => setUpsellToast(null)}
        />
      )}
    </div>
  );
}

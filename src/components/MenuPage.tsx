"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { MenuItemData, CartItem } from "@/types";
import MenuCard from "./MenuCard";
import CartDrawer from "./CartDrawer";
import CheckoutModal from "./CheckoutModal";
import UpsellToast from "./UpsellToast";
import QuirkyDialogue from "./QuirkyDialogue";
import { getUpsellSuggestion, FOOD_TIPS } from "@/lib/upsellEngine";

interface MenuPageProps {
  menuItems: MenuItemData[];
  tableToken?: string;
  tableName?: string;
  orgSlug?: string;
  orgName?: string;
  orgUpiId?: string | null;
  isAdmin?: boolean;  // hide customer-only UI when staff is previewing
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

export default function MenuPage({ menuItems, tableToken, tableName, orgSlug, orgName, orgUpiId, isAdmin = false }: MenuPageProps) {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [showGreeting, setShowGreeting] = useState(true);
  const [lastOrder, setLastOrder] = useState<LastOrder | null>(null);
  const [showReorderBanner, setShowReorderBanner] = useState(false);
  const [isDiningCustomer, setIsDiningCustomer] = useState(false);

  // ── Weather-based suggestion (Open-Meteo, no key needed) ─────────────────
  // Coordinates for pin 560067 (Bengaluru South, Karnataka)
  const [weatherSuggestion, setWeatherSuggestion] = useState<{
    emoji: string; label: string; suggestion: string; items: string[];
  } | null>(null);

  useEffect(() => {
    // WMO weather code → category
    function decodeWeather(code: number, temp: number, rain: number): {
      emoji: string; label: string; suggestion: string; items: string[];
    } {
      if (rain > 0.5 || (code >= 51 && code <= 67) || (code >= 80 && code <= 82))
        return { emoji: "🌧️", label: "Rainy weather", suggestion: "Perfect time to warm up!", items: ["Masala Chai", "Filter Coffee", "Hot Soup", "Pakoda", "Samosa"] };
      if (code >= 71 && code <= 77)
        return { emoji: "🌨️", label: "Chilly outside", suggestion: "Stay cozy with something warm!", items: ["Masala Chai", "Hot Coffee", "Soup", "Idli"] };
      if (code >= 95)
        return { emoji: "⛈️", label: "Thunderstorm outside", suggestion: "Sit back, enjoy something hot!", items: ["Masala Chai", "Hot Soup", "Coffee", "Pakoda"] };
      if (code >= 1 && code <= 3 && temp > 32)
        return { emoji: "🌤️", label: `${temp.toFixed(0)}°C outside`, suggestion: "It's warm — cool down with something refreshing!", items: ["Cold Coffee", "Nimbu Pani", "Lassi", "Ice Cream", "Cold Drink"] };
      if (temp > 28)
        return { emoji: "☀️", label: `${temp.toFixed(0)}°C outside`, suggestion: "Hot day! Try something chilled!", items: ["Cold Coffee", "Lassi", "Ice Cream", "Fresh Juice", "Soda"] };
      if (temp < 20)
        return { emoji: "🌬️", label: `${temp.toFixed(0)}°C outside`, suggestion: "Cool weather — perfect for hot sips!", items: ["Masala Chai", "Filter Coffee", "Hot Chocolate", "Soup"] };
      return { emoji: "🌤️", label: `${temp.toFixed(0)}°C, lovely day`, suggestion: "Great weather, great food — what else do you need?", items: ["Biryani", "Thali", "Dosa", "Filter Coffee"] };
    }

    fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=12.9139&longitude=77.6397&current=temperature_2m,weathercode,precipitation&timezone=Asia%2FKolkata"
    )
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data?.current) return;
        const { temperature_2m: temp, weathercode: code, precipitation: rain } = data.current;
        setWeatherSuggestion(decodeWeather(code, temp, rain));
      })
      .catch(() => {});
  }, []);

  // ── Customer search ───────────────────────────────────────────────────────
  const [customerSearch, setCustomerSearch] = useState("");
  const [searchFocused, setSearchFocused]   = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close suggestions on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Weight-based custom gram entry (for 100g-unit items like Chhenapoda) ──
  const [weightPicker, setWeightPicker] = useState<{ item: MenuItemData } | null>(null);
  const [weightGrams, setWeightGrams]   = useState("");

  /** Returns true if this item needs a custom gram entry before adding */
  function isWeightItem(item: MenuItemData) {
    return item.unit === "100g";
  }

  function addWeightItemToCart() {
    if (!weightPicker) return;
    const grams = parseFloat(weightGrams);
    if (!grams || grams <= 0) return;
    const item = weightPicker.item;
    // item.price is stored per 100g → rate per kg = item.price × 10
    // price for N grams = (N / 1000) × (item.price × 10) = (N / 100) × item.price
    const pricePerKg = item.price * 10;
    const calculatedPrice = Math.ceil((grams / 1000) * pricePerKg);
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItemId === item.id);
      if (existing) {
        const prevGrams = existing.customGrams ?? 0;
        const totalGrams = prevGrams + grams;
        const newPrice = Math.ceil((totalGrams / 1000) * pricePerKg);
        return prev.map((c) =>
          c.menuItemId === item.id
            ? { ...c, price: newPrice, quantity: 1, customGrams: totalGrams, notes: `${totalGrams}g` }
            : c
        );
      }
      return [...prev, {
        menuItemId: item.id,
        name: item.name,
        price: calculatedPrice,
        quantity: 1,
        customGrams: grams,
        notes: `${grams}g`,
      }];
    });
    setWeightPicker(null);
    setWeightGrams("");
    openSpicePicker(item);
  }

  // ── Per-item spice / instruction picker ──────────────────────────────────
  const SPICE_OPTIONS = [
    { label: "Less Spicy 🌶", value: "Less Spicy" },
    { label: "Medium Spicy 🌶🌶", value: "Medium Spicy" },
    { label: "Extra Spicy 🌶🌶🌶", value: "Extra Spicy" },
    { label: "No Spice 🙅", value: "No Spice" },
  ];
  // Categories where spice prompt doesn't make sense
  const NO_SPICE_CATEGORIES = new Set(["Beverages", "Sweets", "Breakfast Delights"]);
  const [spicePicker, setSpicePicker] = useState<{ item: MenuItemData } | null>(null);
  const [pendingSpiceNote, setPendingSpiceNote] = useState("");

  function openSpicePicker(item: MenuItemData) {
    if (NO_SPICE_CATEGORIES.has(item.category) || item.price === 0) return null;
    setSpicePicker({ item });
    setPendingSpiceNote("");
    return "opened";
  }

  function applySpiceNote(note: string) {
    if (!spicePicker) return;
    setCart((prev) =>
      prev.map((c) =>
        c.menuItemId === spicePicker.item.id ? { ...c, notes: note || undefined } : c
      )
    );
    setSpicePicker(null);
  }

  // ── Ghugni upsell prompt ──────────────────────────────────────────────────
  // Items that pair with Ghugni (bara, samosa, gulgula, aloochop variants)
  const GHUGNI_TRIGGER_KEYWORDS = ["bara", "samosa", "gulgula", "aloo chop", "aloochop", "aloo-chop", "singada", "nimki"];
  const [ghugniPrompt, setGhugniPrompt] = useState(false);
  const ghugniTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Generic smart combo prompts ────────────────────────────────────────────
  // Defined in priority order — first matching combo wins
  interface ComboRule {
    triggerKeywords: string[];
    suggestKeywords: string[];   // looked up via partial match in menu
    message: string;
    emoji: string;
  }
  const COMBO_RULES: ComboRule[] = [
    // Tea / Coffee → snacks
    {
      triggerKeywords: ["tea", "chai", "masala chai", "filter coffee", "cold coffee", "coffee"],
      suggestKeywords: ["pakod", "nimki", "samosa", "singada", "bara", "cabbage pakoda"],
      message: "Chai is better with a snack! Add",
      emoji: "🍵",
    },
    // Soup → Momos
    {
      triggerKeywords: ["soup", "manchow", "hot & sour"],
      suggestKeywords: ["momos"],
      message: "Soup + Momos = best combo ever! Add fresh steamed",
      emoji: "🥟",
    },
    // Momos → Soup
    {
      triggerKeywords: ["momos"],
      suggestKeywords: ["manchow", "hot & sour"],
      message: "Momos go best with a hot soup! Try",
      emoji: "🍲",
    },
    // Naan / Paratha / Roti → gravy
    {
      triggerKeywords: ["naan", "paratha", "roti", "kulcha"],
      suggestKeywords: ["dal makhani", "paneer butter", "chicken butter", "chicken curry", "mutton curry", "egg curry"],
      message: "Bread needs a rich gravy! Pair it with",
      emoji: "🫓",
    },
    // Fried Rice / Noodles → soup or momos
    {
      triggerKeywords: ["fried rice", "noodles", "schezwan"],
      suggestKeywords: ["manchow", "hot & sour", "momos"],
      message: "Complete your Chinese platter with a hot",
      emoji: "🍜",
    },
    // Biryani → raita or sweet
    {
      triggerKeywords: ["biryani"],
      suggestKeywords: ["mitha dahi", "curd", "raita", "rasabali", "pahala rasagola"],
      message: "Biryani feels complete with a cool",
      emoji: "🍛",
    },
    // Dosa → curd / sweet
    {
      triggerKeywords: ["dosa", "uttapam", "appam"],
      suggestKeywords: ["mitha dahi", "ghuguni", "coconut chutney"],
      message: "Make your dosa plate complete with",
      emoji: "🥞",
    },
    // Poori / Puri → aloo dum or ghugni
    {
      triggerKeywords: ["poori", "puri"],
      suggestKeywords: ["aloodum", "aloo dum", "ghuguni", "ghugni"],
      message: "Poori is incomplete without",
      emoji: "🫓",
    },
  ];
  const [comboPrompt, setComboPrompt] = useState<{
    message: string; emoji: string;
    suggestedItem: MenuItemData;
  } | null>(null);
  const comboPromptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Dahipani is FREE — only allowed when Dahibara Aloodum is in cart
  const DAHIPANI_TRIGGER_KEYWORDS = ["dahibara", "dahi bara", "dahi-bara", "aloodum", "aloo dum"];
  const [dahipaniPrompt, setDahipaniPrompt] = useState(false);
  const dahipaniTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dahipaniError, setDahipaniError] = useState(false);
  const dahipaniErrRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Odisha Sweets upsell — triggers after ordering a main course ─────────
  // The 5 star sweets to promote
  const ODIA_STAR_SWEETS = ["Chhenapoda (Sugar)", "Chhenapoda (Jaggery)", "Rasabali", "Pahala Rasagola", "Rasmalai", "Chhena Steam", "Malpua"];
  const SWEET_TRIGGER_CATEGORIES = new Set([
    "Thali Corner", "Odisha Special", "Biryani Zone", "Dum Zone",
    "Non-Veg Starters", "Egg Zone", "Fried Rice & Noodles",
    "Dosa Corner", "Soups", "Rolls & Momos", "Breads",
    "North Gravy", "North Spl Gravy", "Evening Snacks", "Morning Snacks",
  ]);
  const [sweetPrompt, setSweetPrompt] = useState(false);
  const sweetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    let validItems = lastOrder.items.filter((i) => availableIds.has(i.menuItemId));
    // Enforce Dahipani rule: remove Dahipani if Dahibara Aloodum is not in the reorder
    const reorderHasAloodum = validItems.some((i) =>
      i.name.toLowerCase().includes("dahibara") ||
      i.name.toLowerCase().includes("aloodum") ||
      i.name.toLowerCase().includes("aloo dum")
    );
    if (!reorderHasAloodum) {
      validItems = validItems.filter((i) => !i.name.toLowerCase().includes("dahipani"));
    }
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
  // Zomato-style: two independent toggles — both off = show all
  const [vegOn, setVegOn]       = useState(false);
  const [nonVegOn, setNonVegOn] = useState(false);
  // derived for existing filter logic
  const vegFilter: "all" | "veg" | "nonveg" =
    vegOn && !nonVegOn ? "veg" : !vegOn && nonVegOn ? "nonveg" : "all";

  // Apply time-based default once categories are known
  useEffect(() => {
    if (defaultCategory !== "All") setActiveCategory(defaultCategory);
  }, [defaultCategory]);

  const allCategories = useMemo(() => ["All", ...categories], [categories]);

  // ── Time-based availability ──────────────────────────────────────────────
  // Before 12:00 PM only breakfast, snack & beverage categories are served.
  // Admin's explicit available=false always takes priority.
  // After noon everything follows the admin's available flag normally.
  const MORNING_CATEGORIES = new Set([
    // legacy name kept for safety
    "Breakfast Delights",
    // current menu category names
    "Odia Breakfast",
    "North Indian Breakfast",
    "Dosa & Idli",
    "Savoury Bites",
    "Paratha Corner",
    "Sweets",
    "Beverages",
  ]);
  const isBeforeNoon = new Date().getHours() < 12;

  function isItemAvailableNow(item: MenuItemData): boolean {
    if (!item.available) return false;                      // admin disabled
    if (isBeforeNoon && !MORNING_CATEGORIES.has(item.category)) return false; // time gate
    return true;
  }

  // Show available items first, unavailable at bottom with a "Sold Out" indicator
  // When a search query is active, search across ALL items (ignore category filter)
  const filtered = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    let pool = q
      ? menuItems.filter((i) =>
          i.name.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q) ||
          (i.description ?? "").toLowerCase().includes(q)
        )
      : (activeCategory === "All"
          ? menuItems
          : menuItems.filter((i) => i.category === activeCategory));

    // Apply veg/non-veg filter
    if (vegFilter === "veg")    pool = pool.filter((i) => i.isVeg);
    if (vegFilter === "nonveg") pool = pool.filter((i) => !i.isVeg);

    // When searching, rank Thali items first (they are the most-ordered combos)
    const thaliFirst = (a: MenuItemData, b: MenuItemData) => {
      if (!q) return 0;
      const aThali = a.name.toLowerCase().includes("thali");
      const bThali = b.name.toLowerCase().includes("thali");
      if (aThali && !bThali) return -1;
      if (!aThali && bThali) return  1;
      return 0;
    };

    const avail   = pool.filter((i) =>  isItemAvailableNow(i)).sort(thaliFirst);
    const unavail = pool.filter((i) => !isItemAvailableNow(i)).sort(thaliFirst);
    return [...avail, ...unavail];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuItems, activeCategory, customerSearch, vegFilter]);

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  function addToCart(item: MenuItemData) {
    // Dahipani is FREE but only allowed when Dahibara Aloodum is in the cart
    const isDahipani = item.name.toLowerCase().includes("dahipani");
    if (isDahipani) {
      const hasAloodum = cart.some((c) =>
        c.name.toLowerCase().includes("dahibara") ||
        c.name.toLowerCase().includes("dahi bara") ||
        c.name.toLowerCase().includes("aloodum") ||
        c.name.toLowerCase().includes("aloo dum")
      );
      if (!hasAloodum) {
        if (dahipaniErrRef.current) clearTimeout(dahipaniErrRef.current);
        setDahipaniError(true);
        dahipaniErrRef.current = setTimeout(() => setDahipaniError(false), 4000);
        return;
      }
    }

    // Weight-based items need a gram entry first
    if (isWeightItem(item)) {
      setWeightPicker({ item });
      setWeightGrams("");
      return;
    }

    setCart((prev) => {
      const existing = prev.find((c) => c.menuItemId === item.id);
      const newCart = existing
        ? prev.map((c) => c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c)
        : [...prev, { menuItemId: item.id, name: item.name, price: item.price, quantity: 1 }];

      // Only show upsell on first add (not repeat increments)
      if (!existing) {
        if (upsellTimeoutRef.current) clearTimeout(upsellTimeoutRef.current);

        // Open spice picker for food items
        openSpicePicker(item);

        // Ghugni upsell — triggered by bara/samosa/gulgula/aloo chop
        const nameLower = item.name.toLowerCase();
        // Dahipani upsell
        const isDahipaniTrigger = DAHIPANI_TRIGGER_KEYWORDS.some((kw) => nameLower.includes(kw));
        const dahipaniItem = menuItems.find((m) => m.name.toLowerCase().includes("dahipani"));
        const dahipaniAlreadyInCart = newCart.some((c) => c.name.toLowerCase().includes("dahipani"));
        if (isDahipaniTrigger && dahipaniItem && !dahipaniAlreadyInCart) {
          setDahipaniPrompt(true);
          if (dahipaniTimeoutRef.current) clearTimeout(dahipaniTimeoutRef.current);
          dahipaniTimeoutRef.current = setTimeout(() => setDahipaniPrompt(false), 15000);
        }

        const isGhugniTrigger = GHUGNI_TRIGGER_KEYWORDS.some((kw) => nameLower.includes(kw));
        const ghugniItem = menuItems.find((m) => m.available && m.name.toLowerCase().includes("ghugni"));
        const ghugniAlreadyInCart = newCart.some((c) => c.name.toLowerCase().includes("ghugni"));
        if (isGhugniTrigger && ghugniItem && !ghugniAlreadyInCart) {
          setGhugniPrompt(true);
          if (ghugniTimeoutRef.current) clearTimeout(ghugniTimeoutRef.current);
          ghugniTimeoutRef.current = setTimeout(() => setGhugniPrompt(false), 12000);
        }

        // ── Generic smart combo trigger ─────────────────────────────────────
        if (!isGhugniTrigger) {
          for (const rule of COMBO_RULES) {
            const isMatch = rule.triggerKeywords.some((kw) => nameLower.includes(kw));
            if (!isMatch) continue;
            // Find first available suggestion not already in cart
            let foundItem: MenuItemData | null = null;
            for (const sk of rule.suggestKeywords) {
              const candidate = menuItems.find(
                (m) => m.available && m.name.toLowerCase().includes(sk) &&
                       !newCart.some((c) => c.menuItemId === m.id)
              );
              if (candidate) { foundItem = candidate; break; }
            }
            if (foundItem) {
              if (comboPromptTimerRef.current) clearTimeout(comboPromptTimerRef.current);
              setComboPrompt({ message: rule.message, emoji: rule.emoji, suggestedItem: foundItem });
              comboPromptTimerRef.current = setTimeout(() => setComboPrompt(null), 12000);
              break;
            }
          }
        }

        // Odisha sweets upsell — show after adding any main course item
        if (SWEET_TRIGGER_CATEGORIES.has(item.category) && item.category !== "Sweets") {
          const hasSweetInCart = newCart.some((c) => {
            const mi = menuItems.find((m) => m.id === c.menuItemId);
            return mi?.category === "Sweets";
          });
          const availableStarSweets = menuItems.filter(
            (m) => m.available && m.category === "Sweets" &&
            ODIA_STAR_SWEETS.some((s) => m.name.toLowerCase().includes(s.toLowerCase()))
          );
          if (!hasSweetInCart && availableStarSweets.length > 0) {
            // Delay slightly so spice picker doesn't clash
            setTimeout(() => {
              setSweetPrompt(true);
              if (sweetTimeoutRef.current) clearTimeout(sweetTimeoutRef.current);
              sweetTimeoutRef.current = setTimeout(() => setSweetPrompt(false), 20000);
            }, 1200);
          }
        }

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
    paidAmount?: number,
    parcelCharge?: number,
    paymentMethod?: "UPI" | "CASH",
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
      parcelCharge: parcelCharge ?? 0,
      paymentMethod: paymentMethod ?? "UPI",
      paidAmount: paidAmount ?? undefined,
      items: cart.map((c) => ({
        menuItemId: c.menuItemId,
        quantity: c.quantity,
        ...(c.notes ? { notes: c.notes } : {}),
        // Send customGrams so the server can calculate the correct price for weight-based items
        ...(c.customGrams ? { customGrams: c.customGrams } : {}),
      })),
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

        {/* Customer search bar with suggestions */}
        <div className="max-w-2xl mx-auto px-4 pb-2" ref={searchRef}>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-300 text-base pointer-events-none">🔍</span>
            <input
              type="search"
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              placeholder="Search items, categories…"
              className="w-full bg-white/20 placeholder-amber-200 text-white rounded-full pl-9 pr-4 py-2 text-sm focus:outline-none focus:bg-white/30 transition-colors"
            />
            {customerSearch && (
              <button
                onClick={() => { setCustomerSearch(""); setSearchFocused(false); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-200 hover:text-white text-base leading-none"
              >
                ×
              </button>
            )}

            {/* Suggestions dropdown */}
            {searchFocused && customerSearch.trim().length >= 1 && (() => {
              const q = customerSearch.trim().toLowerCase();
              // Match items by name or category
              const matched = menuItems
                .filter((m) => m.available && (
                  m.name.toLowerCase().includes(q) ||
                  m.category.toLowerCase().includes(q)
                ))
                .slice(0, 6);
              // Unique matching categories
              const matchedCats = [...new Set(
                menuItems.filter((m) => m.category.toLowerCase().includes(q)).map((m) => m.category)
              )].slice(0, 3);
              if (matched.length === 0 && matchedCats.length === 0) return null;
              return (
                <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden">
                  {matchedCats.length > 0 && (
                    <div className="px-3 pt-2 pb-1">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Categories</p>
                      <div className="flex flex-wrap gap-1.5">
                        {matchedCats.map((cat) => (
                          <button
                            key={cat}
                            onMouseDown={(e) => { e.preventDefault(); setCustomerSearch(cat); setSearchFocused(false); }}
                            className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 rounded-full font-semibold hover:bg-amber-100 transition-colors"
                          >
                            📂 {cat}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {matched.length > 0 && (
                    <div className="px-1 pt-1 pb-1">
                      {matchedCats.length > 0 && <div className="border-t border-slate-100 mt-2 mb-1" />}
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-2 mb-1">Items</p>
                      {matched.map((item) => (
                        <button
                          key={item.id}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setCustomerSearch(item.name);
                            setSearchFocused(false);
                          }}
                          className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-amber-50 transition-colors flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`flex-shrink-0 inline-flex w-3.5 h-3.5 rounded-sm border-2 items-center justify-center ${item.isVeg ? "border-green-600" : "border-red-600"}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${item.isVeg ? "bg-green-600" : "bg-red-600"}`} />
                            </span>
                            <span className="font-semibold text-slate-800 text-sm truncate">{item.name}</span>
                            <span className="text-xs text-slate-400 truncate hidden sm:block">{item.category}</span>
                          </div>
                          <span className="text-sm font-bold text-amber-600 flex-shrink-0">₹{item.price}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>

        {/* ── Zomato-style Veg / Non-Veg toggles — customer only ── */}
        {!isAdmin && <div className="max-w-2xl mx-auto px-4 pb-3 flex items-center gap-3">
          {/* Pure Veg toggle */}
          <button
            onClick={() => { setVegOn((v) => { if (!v) setActiveCategory("All"); return !v; }); }}
            className={`relative flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 select-none ${
              vegOn
                ? "bg-green-600 text-white shadow-lg shadow-green-900/30"
                : "bg-white/15 text-white border border-white/30 hover:bg-white/25"
            }`}
          >
            {/* Veg icon — green square with circle inside */}
            <span className={`inline-flex w-4 h-4 rounded-sm border-2 items-center justify-center flex-shrink-0 transition-colors ${vegOn ? "border-white" : "border-green-400"}`}>
              <span className={`w-2 h-2 rounded-full transition-colors ${vegOn ? "bg-white" : "bg-green-400"}`} />
            </span>
            Pure Veg
          </button>

          {/* Non-Veg toggle */}
          <button
            onClick={() => { setNonVegOn((v) => { if (!v) setActiveCategory("All"); return !v; }); }}
            className={`relative flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 select-none ${
              nonVegOn
                ? "bg-red-600 text-white shadow-lg shadow-red-900/30"
                : "bg-white/15 text-white border border-white/30 hover:bg-white/25"
            }`}
          >
            {/* Non-veg icon — red square with red triangle / circle */}
            <span className={`inline-flex w-4 h-4 rounded-sm border-2 items-center justify-center flex-shrink-0 transition-colors ${nonVegOn ? "border-white" : "border-red-400"}`}>
              <span className={`w-2 h-2 rounded-full transition-colors ${nonVegOn ? "bg-white" : "bg-red-400"}`} />
            </span>
            Non-Veg
          </button>

          {/* Active filter badge */}
          {(vegOn || nonVegOn) && (
            <button
              onClick={() => { setVegOn(false); setNonVegOn(false); }}
              className="ml-auto flex items-center gap-1 text-xs text-amber-200 hover:text-white transition-colors"
            >
              <span>✕</span> Clear
            </button>
          )}
        </div>}

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

      {/* Main scroll area — extra bottom padding when floating cart bar is visible so it never covers the last item's Add button */}
      <div style={cartCount > 0 ? { paddingBottom: "calc(96px + env(safe-area-inset-bottom, 0px))" } : undefined}>

      {/* Morning hours notice */}
      {isBeforeNoon && (
        <div className="max-w-2xl mx-auto px-4 pt-3">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="text-2xl">☀️</span>
            <div>
              <p className="text-sm font-bold text-amber-800">Good Morning! Breakfast menu is live</p>
              <p className="text-xs text-amber-600">Full menu (Biryani, Chinese, Starters etc.) opens at 12:00 PM</p>
            </div>
          </div>
        </div>
      )}

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

      {/* Weather-based suggestion banner — only shown when ≥1 item from the live menu matches */}
      {weatherSuggestion && weatherSuggestion.items.some((item) =>
        menuItems.some((m) => m.available && m.name.toLowerCase().includes(item.toLowerCase()))
      ) && (
        <div className="max-w-2xl mx-auto px-4 pt-3">
          <div className="bg-gradient-to-r from-sky-50 to-cyan-50 border border-sky-200 rounded-2xl px-5 py-3.5 flex items-start gap-3 shadow-sm">
            <span className="text-3xl flex-shrink-0 mt-0.5">{weatherSuggestion.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-800 text-sm">{weatherSuggestion.label}</p>
              <p className="text-xs text-slate-500 mt-0.5">{weatherSuggestion.suggestion}</p>
              {(() => {
                const matched = weatherSuggestion.items
                  .map((item) => menuItems.find((m) =>
                    m.available && m.name.toLowerCase().includes(item.toLowerCase())
                  ))
                  .filter((m): m is MenuItemData => !!m)
                  // de-duplicate by id
                  .filter((m, i, arr) => arr.findIndex((x) => x.id === m.id) === i);
                return matched.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {matched.map((match) => (
                      <button
                        key={match.id}
                        onClick={() => addToCart(match)}
                        className="text-xs bg-sky-100 hover:bg-sky-200 text-sky-700 font-semibold px-2.5 py-1 rounded-full border border-sky-200 transition-colors"
                      >
                        + {match.name}
                      </button>
                    ))}
                  </div>
                ) : null;
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Ghugni upsell prompt */}
      {/* ── Weight picker bottom sheet (100g-unit items like Chhenapoda) ── */}
      {weightPicker && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setWeightPicker(null)} />
          <div className="relative w-full bg-white rounded-t-3xl shadow-2xl px-5 pt-5 pb-8">
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4" />
            <p className="font-black text-slate-800 text-base mb-0.5">
              ⚖️ How many grams of <span className="text-amber-600">{weightPicker.item.name}</span>?
            </p>
            {/* Rate display: stored as price-per-100g, show as per-kg for clarity */}
            <p className="text-slate-500 text-xs mb-1">
              Rate: <span className="font-semibold text-slate-700">₹{weightPicker.item.price * 10}/kg</span>
            </p>
            {weightGrams && parseFloat(weightGrams) > 0 && (
              <p className="text-sm font-bold text-amber-600 mb-4">
                {weightGrams}g × ₹{weightPicker.item.price * 10}/kg = ₹{Math.ceil((parseFloat(weightGrams) / 1000) * (weightPicker.item.price * 10))}
              </p>
            )}
            {(!weightGrams || parseFloat(weightGrams) <= 0) && <div className="mb-4" />}

            {/* Quick gram chips */}
            <div className="flex flex-wrap gap-2 mb-4">
              {[50, 80, 100, 150, 200, 250, 500].map((g) => (
                <button key={g} onClick={() => setWeightGrams(String(g))}
                  className={`px-4 py-2 rounded-full border-2 font-semibold text-sm transition-all ${
                    weightGrams === String(g)
                      ? "border-amber-500 bg-amber-50 text-amber-700"
                      : "border-slate-200 text-slate-600 hover:border-amber-300"
                  }`}>
                  {g}g
                  <span className="ml-1 text-xs text-slate-400">
                    ₹{Math.ceil((g / 1000) * (weightPicker.item.price * 10))}
                  </span>
                </button>
              ))}
            </div>

            {/* Custom gram input */}
            <div className="flex items-center gap-3 mb-5">
              <input
                type="number"
                min="10"
                max="5000"
                value={weightGrams}
                onChange={(e) => setWeightGrams(e.target.value)}
                placeholder="Enter grams e.g. 80"
                className="flex-1 border-2 border-slate-200 focus:border-amber-400 rounded-xl px-4 py-3 text-lg font-bold text-slate-800 bg-white focus:outline-none"
                onKeyDown={(e) => { if (e.key === "Enter") addWeightItemToCart(); }}
                autoFocus
              />
              <span className="text-slate-500 font-medium">grams</span>
            </div>

            <button
              onClick={addWeightItemToCart}
              disabled={!weightGrams || parseFloat(weightGrams) <= 0}
              className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black py-4 rounded-2xl text-base transition-colors">
              {weightGrams && parseFloat(weightGrams) > 0
                ? `Add ${weightGrams}g — ₹${Math.ceil((parseFloat(weightGrams) / 1000) * (weightPicker.item.price * 10))}`
                : "Enter grams to add"}
            </button>
            <button onClick={() => setWeightPicker(null)} className="mt-2 w-full text-slate-400 text-xs py-1.5">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Spice / instruction picker bottom sheet ── */}
      {spicePicker && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSpicePicker(null)} />
          <div className="relative w-full bg-white rounded-t-3xl shadow-2xl px-5 pt-5 pb-8">
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4" />
            <p className="font-black text-slate-800 text-base mb-0.5">
              🍽️ How spicy for <span className="text-amber-600">{spicePicker.item.name}</span>?
            </p>
            <p className="text-slate-500 text-xs mb-4">We&apos;ll take care of it exactly the way you like!</p>

            {/* Quick spice chips */}
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              {SPICE_OPTIONS.map((opt) => (
                <button key={opt.value} onClick={() => applySpiceNote(opt.value)}
                  className={`py-3 rounded-xl border-2 font-semibold text-sm transition-all ${
                    pendingSpiceNote === opt.value
                      ? "border-amber-500 bg-amber-50 text-amber-700"
                      : "border-slate-200 text-slate-700 hover:border-amber-300"
                  }`}
                  onMouseEnter={() => setPendingSpiceNote(opt.value)}>
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Custom instruction */}
            <div className="mb-4">
              <input
                type="text"
                placeholder="Any other instruction? e.g. No onion, extra gravy…"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 bg-white placeholder-slate-400 focus:outline-none focus:border-amber-400"
                onKeyDown={(e) => { if (e.key === "Enter") applySpiceNote((e.target as HTMLInputElement).value); }}
              />
              <p className="text-xs text-slate-400 mt-1">Press Enter or tap Skip to continue</p>
            </div>

            <button onClick={() => applySpiceNote("")}
              className="w-full py-3 text-slate-500 text-sm font-medium">
              Skip — no preference
            </button>
          </div>
        </div>
      )}

      {/* Dahipani error — blocked unless Dahibara Aloodum is in cart */}
      {dahipaniError && (
        <div className="fixed bottom-24 left-0 right-0 z-50 px-4">
          <div className="max-w-md mx-auto bg-red-600 text-white rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3">
            <span className="text-2xl">🚫</span>
            <div className="flex-1">
              <p className="font-black text-sm">Dahipani is only free with Dahibara Aloodum</p>
              <p className="text-red-100 text-xs mt-0.5">Add Dahibara Aloodum first, then Dahipani will be FREE!</p>
            </div>
            <button onClick={() => setDahipaniError(false)} className="text-red-200 text-lg font-bold flex-shrink-0">✕</button>
          </div>
        </div>
      )}

      {/* Dahipani free item prompt */}
      {dahipaniPrompt && (() => {
        const dahipaniItem = menuItems.find((m) => m.name.toLowerCase().includes("dahipani"));
        const alreadyInCart = cart.some((c) => c.name.toLowerCase().includes("dahipani"));
        if (!dahipaniItem || alreadyInCart) return null;
        return (
          <div className="fixed bottom-24 left-0 right-0 z-40 px-4 animate-bounce-once">
            <div className="max-w-md mx-auto bg-gradient-to-r from-cyan-500 to-teal-500 text-white rounded-2xl shadow-2xl px-4 py-4 flex items-center gap-3">
              <span className="text-3xl">🥛</span>
              <div className="flex-1 min-w-0">
                <p className="font-black text-sm leading-tight">Dahibara special! Get Dahipani FREE</p>
                <p className="text-cyan-100 text-xs mt-0.5">Odia tradition — spiced yogurt water is on us! 🎉</p>
              </div>
              <button
                onClick={() => { addToCart(dahipaniItem); setDahipaniPrompt(false); }}
                className="flex-shrink-0 bg-white text-teal-700 font-black text-sm px-3 py-2 rounded-xl shadow">
                + FREE
              </button>
              <button onClick={() => setDahipaniPrompt(false)}
                className="flex-shrink-0 text-cyan-200 text-lg font-bold ml-1">✕</button>
            </div>
          </div>
        );
      })()}

      {ghugniPrompt && (() => {
        const ghugniItem = menuItems.find((m) => m.available && m.name.toLowerCase().includes("ghugni"));
        const alreadyInCart = cart.some((c) => c.name.toLowerCase().includes("ghugni"));
        if (!ghugniItem || alreadyInCart) return null;
        return (
          <div className="max-w-2xl mx-auto px-4 pt-3">
            <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-amber-300 rounded-2xl px-5 py-4 flex items-center gap-4 shadow-md">
              <span className="text-4xl flex-shrink-0">🍲</span>
              <div className="flex-1 min-w-0">
                <p className="font-black text-slate-800 text-sm">Arre! Ghugni bhi lo na! 😋</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {ghugniItem.name} pairs perfectly with what you just added — only <span className="font-bold text-amber-600">₹{ghugniItem.price}</span>!
                </p>
              </div>
              <div className="flex flex-col gap-1.5 flex-shrink-0">
                <button
                  onClick={() => { addToCart(ghugniItem); setGhugniPrompt(false); }}
                  className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors whitespace-nowrap"
                >
                  + Add ₹{ghugniItem.price}
                </button>
                <button
                  onClick={() => setGhugniPrompt(false)}
                  className="text-slate-400 hover:text-slate-600 text-xs text-center transition-colors"
                >
                  No thanks
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Smart combo prompt (Tea→Pakodi, Soup→Momos, Naan→Gravy etc.) ── */}
      {comboPrompt && (() => {
        const alreadyInCart = cart.some((c) => c.menuItemId === comboPrompt.suggestedItem.id);
        if (alreadyInCart) return null;
        return (
          <div className="max-w-2xl mx-auto px-4 pt-3">
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-300 rounded-2xl px-5 py-4 flex items-center gap-4 shadow-md">
              <span className="text-4xl flex-shrink-0">{comboPrompt.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="font-black text-slate-800 text-sm">{comboPrompt.message}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  <span className="font-semibold text-amber-700">{comboPrompt.suggestedItem.name}</span>
                  {" "}— only <span className="font-bold text-amber-600">₹{comboPrompt.suggestedItem.price}</span>
                  {comboPrompt.suggestedItem.price === 0 && <span className="text-green-600 font-bold"> FREE!</span>}
                </p>
              </div>
              <div className="flex flex-col gap-1.5 flex-shrink-0">
                <button
                  onClick={() => { addToCart(comboPrompt.suggestedItem); setComboPrompt(null); }}
                  className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors whitespace-nowrap"
                >
                  {comboPrompt.suggestedItem.price === 0 ? "Add FREE" : `+ Add ₹${comboPrompt.suggestedItem.price}`}
                </button>
                <button
                  onClick={() => setComboPrompt(null)}
                  className="text-slate-400 hover:text-slate-600 text-xs text-center transition-colors"
                >
                  No thanks
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Odisha Star Sweets upsell bottom sheet ── */}
      {sweetPrompt && (() => {
        const allSweets = menuItems.filter(
          (m) => m.available && m.category === "Sweets" &&
          ODIA_STAR_SWEETS.some((s) => m.name.toLowerCase().includes(s.toLowerCase()))
        );
        if (allSweets.length === 0) return null;
        // Sort in defined priority order: Chhenapoda, Rasabali, Rasagola, Rasmalai, then rest
        const SWEET_ORDER = ["chhenapoda", "rasabali", "rasagola", "rasmalai", "chhena steam", "malpua"];
        const starSweets = [...allSweets].sort((a, b) => {
          const ai = SWEET_ORDER.findIndex((k) => a.name.toLowerCase().includes(k));
          const bi = SWEET_ORDER.findIndex((k) => b.name.toLowerCase().includes(k));
          return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
        });
        return (
          <div className="fixed inset-0 z-40 flex items-end" onClick={() => setSweetPrompt(false)}>
            <div className="absolute inset-0 bg-black/30" />
            <div
              className="relative w-full bg-white rounded-t-3xl shadow-2xl px-4 pt-5 pb-8 max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-1" />
              <button onClick={() => setSweetPrompt(false)} className="absolute top-4 right-4 text-slate-400 text-xl font-bold">✕</button>

              {/* Header */}
              <div className="text-center mb-4">
                <p className="text-3xl mb-1">🍮</p>
                <p className="font-black text-slate-800 text-lg leading-tight">End with Odisha&apos;s finest sweets!</p>
                <p className="text-slate-500 text-sm mt-1">All made fresh in-house daily 🌟</p>
              </div>

              {/* Sweet cards */}
              <div className="flex flex-col gap-3">
                {starSweets.map((sweet) => {
                  const inCart = cart.some((c) => c.menuItemId === sweet.id);
                  const nameLow = sweet.name.toLowerCase();
                  const emoji =
                    nameLow.includes("chhenapoda") ? "🍮" :
                    nameLow.includes("rasagola")   ? "🍡" :
                    nameLow.includes("rasabali")   ? "🥛" :
                    nameLow.includes("rasmalai")   ? "🍮" :
                    nameLow.includes("malpua")     ? "🥞" :
                    nameLow.includes("chhena")     ? "🍰" : "🍯";
                  const desc =
                    nameLow.includes("chhenapoda") ? "Baked caramelised chhena — smoky, dense & heavenly 🔥" :
                    nameLow.includes("rasabali")   ? "Soft chhena patties soaked in rich condensed milk 🥛" :
                    nameLow.includes("rasagola")   ? "Authentic Pahala-style — spongy & lightly sweet 🌸" :
                    nameLow.includes("rasmalai")   ? "Silky chhena discs in chilled saffron milk ✨" :
                    nameLow.includes("chhena steam") ? "Steamed chhena — melt-in-mouth, light & delicate ✨" :
                    nameLow.includes("malpua")     ? "Pan-fried sweet pancake with a crispy golden edge 🍯" : "";
                  return (
                    <div key={sweet.id}
                      className={`flex items-center gap-3 rounded-2xl px-4 py-3 border-2 transition-all ${
                        inCart ? "border-green-400 bg-green-50" : "border-amber-200 bg-amber-50"
                      }`}>
                      <span className="text-3xl flex-shrink-0">{emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-800 text-sm leading-tight">{sweet.name}</p>
                        {desc && <p className="text-xs text-slate-500 mt-0.5">{desc}</p>}
                        <p className="text-amber-600 font-black text-sm mt-1">
                          {sweet.unit === "100g" ? `₹${sweet.price * 10}/kg` : `₹${sweet.price}`}
                          {sweet.unit === "100g" && <span className="ml-1 text-xs text-orange-500 font-normal">· enter any grams</span>}
                        </p>
                      </div>
                      {inCart ? (
                        <span className="flex-shrink-0 text-green-600 font-black text-xs bg-green-100 px-3 py-2 rounded-xl">✓ Added</span>
                      ) : (
                        <button
                          onClick={() => { addToCart(sweet); }}
                          className="flex-shrink-0 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs px-4 py-2 rounded-xl transition-colors whitespace-nowrap">
                          {sweet.unit === "100g" ? "⚖️ Add" : "+ Add"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => setSweetPrompt(false)}
                className="mt-5 w-full text-slate-400 text-xs py-1.5 text-center">
                No thanks, skip dessert
              </button>
            </div>
          </div>
        );
      })()}

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
            const ctaQ = FOOD_TIPS[tipIndex].cta!.toLowerCase();
            // partial / fuzzy match so long item names with suffixes still resolve
            const ctaItem = menuItems.find(
              (m) => m.available && m.name.toLowerCase().includes(ctaQ)
            );
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
            <div className="text-5xl mb-3">{customerSearch ? "🔍" : "🍽️"}</div>
            <p>{customerSearch ? `No items found for "${customerSearch}"` : "No items in this category"}</p>
            {customerSearch && (
              <button
                onClick={() => setCustomerSearch("")}
                className="mt-3 text-amber-500 font-semibold text-sm hover:underline"
              >
                Clear search
              </button>
            )}
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

      </div>{/* end padding wrapper */}

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
        menuItems={menuItems}
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

      {/* Quirky Odia/Hindi/English dialogue bubbles */}
      {!checkoutOpen && !cartOpen && <QuirkyDialogue />}

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

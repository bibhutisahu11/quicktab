/**
 * Upsell / Cross-sell engine
 * Suggests complementary items based on what the customer just added to cart.
 */

export interface UpsellSuggestion {
  message: string;       // e.g. "Why not pair your Tea with…"
  itemNames: string[];   // suggested item names to look up in the menu
  emoji: string;
}

// Category → what to suggest (item names or category names)
const PAIRINGS: Record<string, UpsellSuggestion> = {
  "Beverages": {
    message: "Tea alone? That's just half the story! 😄 Grab a",
    itemNames: ["Nimki", "Samosa (Bharta)", "Samosa (Cut Aloo)", "Cabbage Pakoda", "Aloo Pakodi"],
    emoji: "🍵",
  },
  "Evening Snacks": {
    message: "Snacks are better with a drink! How about adding",
    itemNames: ["Lime Soda", "Fresh Lime Water", "Soft Drink (Small)"],
    emoji: "🥤",
  },
  "Breakfast Delights": {
    message: "Make it a complete breakfast! Pair with",
    itemNames: ["Kakara Pitha", "Ghuguni", "Mitha Dahibara", "Chakuli Pitha"],
    emoji: "☀️",
  },
  "Dosa Corner": {
    message: "Dosa and…? Complete the combo with",
    itemNames: ["Mitha Dahi (Sweet Curd)", "Lime Soda", "Rasmalai", "Pahala Rasagola"],
    emoji: "🥞",
  },
  "Biryani Zone": {
    message: "Great choice! The perfect finish after Biryani is",
    itemNames: ["Chhenapoda Sugar (per Kg)", "Pahala Rasagola", "Rasmalai", "Malpua", "Gulab Jamun"],
    emoji: "🍛",
  },
  "Dum Zone": {
    message: "Dum Biryani + Dessert = Pure Bliss! Try",
    itemNames: ["Chhenapoda Jaggery (per Kg)", "Pahala Rasagola", "Chhena Steam", "Rasmalai"],
    emoji: "🍮",
  },
  "Non-Veg Starters": {
    message: "Great starter! Pair it with a hot",
    itemNames: ["Hot & Sour Chicken", "Chicken Manchow", "Veg Manchow", "Hot & Sour Veg"],
    emoji: "🍗",
  },
  "Soups": {
    message: "Soup as a starter? Perfect! Follow it with",
    itemNames: ["Chicken Dum Biryani", "Mutton Biryani", "Paneer Biryani", "Veg Biryani"],
    emoji: "🍲",
  },
  "Rolls & Momos": {
    message: "Rolls & Momos love company! Add some",
    itemNames: ["Chicken Manchow", "Hot & Sour Veg", "Lime Soda", "Soft Drink (Small)"],
    emoji: "🥟",
  },
  "Fried Rice & Noodles": {
    message: "Add a sweet ending to your meal!",
    itemNames: ["Gulab Jamun", "Rasmalai", "Malpua", "Chhena Jhilli"],
    emoji: "🍜",
  },
  "Breads": {
    message: "Breads go best with a rich gravy! How about",
    itemNames: ["Chicken Manchurian Gravy", "Veg Biryani", "Paneer Dum Biryani"],
    emoji: "🫓",
  },
  "Sweets": {
    message: "Ending on a sweet note? Why not make it a full meal with",
    itemNames: ["Chicken Dum Biryani", "Mutton Biryani", "Veg Dum Biryani"],
    emoji: "🍯",
  },
  "Biryani Zone": {
    message: "🚀 20% OFF! Since you're having Biryani, try our Chinese too! Add",
    itemNames: ["Chicken Hakka Noodles", "Veg Noodles", "Chicken Fried Rice", "Veg Fried Rice"],
    emoji: "🍜",
  },
  "Dum Zone": {
    message: "🚀 20% OFF! Complete the feast — add a Chinese side too!",
    itemNames: ["Chicken Manchow", "Hot & Sour Chicken", "Veg Manchow"],
    emoji: "🍲",
  },
  "Fried Rice & Noodles": {
    message: "🚀 20% OFF! Having Chinese? Add some Biryani to share!",
    itemNames: ["Chicken Dum Biryani", "Paneer Biryani", "Veg Biryani"],
    emoji: "🍛",
  },
  "Egg Zone": {
    message: "Eggs & Bread — classic! Add",
    itemNames: ["Butter Naan", "Malabar Paratha", "Butter Roti", "Garlic Butter Naan"],
    emoji: "🥚",
  },
};

const DEFAULT_SUGGESTION: UpsellSuggestion = {
  message: "While you're at it, try our bestseller",
  itemNames: ["Chhenapoda Sugar (per Kg)", "Pahala Rasagola", "Chicken Satay (6 pcs)", "Dahibara Aloodum"],
  emoji: "⭐",
};

/** Pick one random item from the suggestion list that is actually in the menu */
export function getUpsellSuggestion(
  addedItemCategory: string,
  menuItems: { id: string; name: string; price: number; available: boolean; category: string }[],
  cartItemIds: Set<string>,
): { suggestion: UpsellSuggestion; item: { id: string; name: string; price: number } } | null {
  const rule = PAIRINGS[addedItemCategory] ?? DEFAULT_SUGGESTION;

  // Find available menu items matching the suggestion names (not already in cart)
  const candidates = rule.itemNames
    .map((name) => menuItems.find((m) => m.available && m.name === name && !cartItemIds.has(m.id)))
    .filter(Boolean) as { id: string; name: string; price: number; category: string }[];

  // Shuffle and pick first
  if (candidates.length === 0) {
    // Fallback: suggest a random sweet/expensive item not in cart
    const fallback = menuItems
      .filter((m) => m.available && !cartItemIds.has(m.id) && m.price >= 100)
      .sort(() => Math.random() - 0.5)[0];
    if (!fallback) return null;
    return { suggestion: DEFAULT_SUGGESTION, item: fallback };
  }

  const picked = candidates[Math.floor(Math.random() * candidates.length)];
  return { suggestion: rule, item: picked };
}

// ── Rotating food tips / upsell banners ──────────────────────────────────────

export const FOOD_TIPS = [
  // Launch offer promos — show these more prominently
  { text: "🚀 LAUNCH OFFER! Our Biryani & Chinese items are NOW 20% OFF — newly launched! Try today!", cta: "Chicken Dum Biryani" },
  { text: "🍛 We just launched Biryani! Slow-cooked Mutton Dum Biryani is flying off tables — grab yours at 20% OFF!", cta: "Mutton Biryani" },
  { text: "🍜 Craving Chinese? Chicken Hakka Noodles, Fried Rice, Manchurian — all 20% OFF right now! 🔥", cta: "Chicken Hakka Noodles" },
  { text: "🍲 Warm your soul — Chicken Manchow Soup with a side of Biryani? Both at 20% OFF today!", cta: "Chicken Manchow" },
  { text: "🏆 Chef's pick: Chicken Satay — lightly spiced, perfectly grilled! Most ordered starter!", cta: "Chicken Satay (6 pcs)" },
  { text: "🍮 Odisha's pride — Chhenapoda baked fresh every morning. The perfect sweet ending 🍯", cta: "Chhenapoda Sugar (per Kg)" },
  { text: "🌟 Soul of Odisha in one bowl — Dahibara Aloodum. Try something truly local today!", cta: "Dahibara Aloodum" },
  { text: "💫 Authentic Pahala Rasagola — made with real Chhena, sweeter than any store-bought!", cta: "Pahala Rasagola" },
  { text: "🔥 Hot from the tandoor — Garlic Butter Naan pairs perfectly with any Biryani or gravy.", cta: "Garlic Butter Naan" },
  { text: "🥇 Table favourite: Cabbage Pakoda — crispy, golden, totally addictive! ⭐ Must Try!", cta: "Cabbage Pakoda" },
  { text: "🎉 Feeding a group? Family Pack Biryani (Serves 3) for just ₹510 — best deal in town!", cta: "Chicken Family Pack Biryani (Serves 3)" },
  { text: "😋 Traditional Odia Kakara Pitha — sweet, crispy, unforgettable. Try something new!", cta: "Kakara Pitha" },
  { text: "🍵 Nimki + Tea = the most satisfying combo ever. Add some to your order!", cta: "Nimki" },
  { text: "🦐 Fresh Bali Prawn — coastal Odia flavour, cooked with love. Only ₹230 for 6 pcs!", cta: "Bali Prawn (6 pcs)" },
  { text: "🍡 Life is short — save room for dessert! Rasmalai, Chhena Steam, Gulab Jamun Roll 🍯", cta: "Rasmalai" },
  { text: "✨ 'Food tastes better when shared with loved ones.' — Why not order something extra today?", cta: null },
  { text: "🌿 Fresh every day · Sunflower & Mustard Oil only · No compromise on quality ❤️ — Kalinga Bites", cta: null },
];

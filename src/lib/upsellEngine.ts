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
    message: "🚀 20% OFF! Since you're having Biryani, try our Chinese too! Add",
    itemNames: ["Chicken Hakka Noodles", "Veg Noodles", "Chicken Fried Rice", "Veg Fried Rice"],
    emoji: "🍜",
  },
  "Dum Zone": {
    message: "🚀 20% OFF! Complete the feast — add a Chinese side too!",
    itemNames: ["Chicken Manchow", "Hot & Sour Chicken", "Veg Manchow"],
    emoji: "🍲",
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
    message: "🚀 20% OFF! Having Chinese? Add some Biryani to share!",
    itemNames: ["Chicken Dum Biryani", "Paneer Biryani", "Veg Biryani"],
    emoji: "🍛",
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

// ── Quirky Odia / Hindi / English dialogues ─────────────────────────────────
// Shown randomly on the menu as floating speech bubbles

export const QUIRKY_DIALOGUES = [
  // 🟠 ODIA — FUNNY & LOCAL
  { lang: "Odia 🏛️",       text: "\"Dahibara dekhile diet bhuli jiba! 😂\"",          subtext: "One look at Dahibara and the diet is forgotten!" },
  { lang: "Odia 🏛️",       text: "\"Aloo Dum ra jadu alaga! 😋\"",                    subtext: "Aloo Dum has a magic of its own!" },
  { lang: "Odia 🏛️",       text: "\"Dahibara + Aloo Dum = Full Khusi! ❤️\"",          subtext: "The ultimate happiness combo!" },
  { lang: "Odia 🏛️",       text: "\"Bara kha, mana khusi kara! 😎\"",                 subtext: "Eat Bara, make your heart happy!" },
  { lang: "Odia 🏛️",       text: "\"Singada gotie re mana bhariba nahi! 😂\"",         subtext: "One Singada is never enough!" },
  { lang: "Odia 🏛️",       text: "\"Rasagola dekhi kie na kahiba? 🤤\"",              subtext: "Who can say no after seeing Rasagola?" },
  { lang: "Odia 🏛️",       text: "\"Khaja achhi... ebe kana darkar? 😌\"",            subtext: "There's Khaja... what more do you need?" },
  { lang: "Odia 🏛️",       text: "\"Peta kahuchi aau tike! 😂\"",                     subtext: "The tummy says: just a little more!" },
  { lang: "Odia 🏛️",       text: "\"Aji diet nuhe, aji Odia food! 😎\"",              subtext: "No diet today, today is Odia food day!" },
  { lang: "Odia 🏛️",       text: "\"Khaa bhai, eita ghara ra swad! ❤️\"",            subtext: "Eat, brother — this tastes like home!" },
  { lang: "Odia 🏛️",       text: "\"Odia khaiba hele mana kahiba—Aau de! 😂\"",       subtext: "With Odia food, your heart will say—give me more!" },
  { lang: "Odia 🏛️",       text: "\"Peta bhari gala, mana kahuchi aau! 🤣\"",         subtext: "The tummy is full, but the heart wants more!" },

  // 🟢 HINDI — FOOD HUMOUR
  { lang: "Hindi 🇮🇳",     text: "\"Dahibara dekha aur diet bhool jao! 😂\"",          subtext: "See the Dahibara, forget the diet!" },
  { lang: "Hindi 🇮🇳",     text: "\"Aloo Dum ho toh mood bhi dumdaar! 😎\"",           subtext: "With Aloo Dum, the mood gets dumdaar too!" },
  { lang: "Hindi 🇮🇳",     text: "\"Ek plate? Bhai, mazaak mat karo! 😂\"",            subtext: "One plate? Come on, be serious!" },
  { lang: "Hindi 🇮🇳",     text: "\"Pet bhar gaya... dil abhi bhi ready hai! 🤣\"",    subtext: "The tummy is full, but the heart is still ready!" },
  { lang: "Hindi 🇮🇳",     text: "\"Rasagola ke liye jagah hamesha hoti hai! ❤️\"",    subtext: "There's always room for Rasagola!" },
  { lang: "Hindi 🇮🇳",     text: "\"Aaj calories nahi, sirf khushiyan ginni hain! 😋\"", subtext: "Today we're counting happiness, not calories!" },
  { lang: "Hindi 🇮🇳",     text: "\"Bhookh ka jawab—Odia swaad! 🔥\"",                subtext: "The answer to hunger—Odia flavour!" },
  { lang: "Hindi 🇮🇳",     text: "\"Kha lo... regret sirf tab hoga jab nahi khaoge! 😂\"", subtext: "Eat... you'll only regret not eating!" },

  // 🔵 ENGLISH — SHORT & QUIRKY
  { lang: "English 🌎",    text: "\"Dahibara first. Questions later. 😎\"",             subtext: "Priorities!" },
  { lang: "English 🌎",    text: "\"Aloo Dum made me do it. 😂\"",                     subtext: "Zero regrets!" },
  { lang: "English 🌎",    text: "\"One plate? That's adorable. 🤣\"",                 subtext: "You definitely need another!" },
  { lang: "English 🌎",    text: "\"Rasagola has its own stomach. 🤤\"",               subtext: "There is ALWAYS room for dessert!" },
  { lang: "English 🌎",    text: "\"Odia food. Full heart. Happy tummy. ❤️\"",         subtext: "Simple equation!" },
  { lang: "English 🌎",    text: "\"Dahibara called. We answered. 😋\"",               subtext: "And now it's your turn!" },
  { lang: "English 🌎",    text: "\"Your diet can wait. Dahibara can't. 😂\"",         subtext: "Some things are more important." },
  { lang: "English 🌎",    text: "\"Warning: Odia food may cause happiness. 🤤\"",     subtext: "Proceed without caution!" },
  { lang: "English 🌎",    text: "\"Come for one bite. Stay for five plates. 😂\"",    subtext: "We've all been there!" },
  { lang: "English 🌎",    text: "\"Odia cravings? You're in the right place. 🔥\"",   subtext: "Welcome to Kalinga Bites!" },

  // 🟣 KALINGA BITES BRAND LINES
  { lang: "Kalinga Bites ❤️", text: "\"Ame Odia, bhari badhia! 😎\"",                 subtext: "Kalinga Bites — Odisha on your plate!" },
  { lang: "Kalinga Bites ❤️", text: "\"Bhookh Odisha ra, jawab Kalinga Bites ra! 🔥\"", subtext: "Your Odisha craving has found its answer!" },
  { lang: "Kalinga Bites ❤️", text: "\"Odia swad, Bengaluru re! ❤️\"",                subtext: "The taste of Odisha, right here in Bengaluru!" },
  { lang: "Kalinga Bites ❤️", text: "\"Gharara swad, Kalinga Bites ra! 😋\"",          subtext: "That homely Odisha taste, at Kalinga Bites!" },
];

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

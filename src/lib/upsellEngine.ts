/**
 * Upsell / Cross-sell engine
 * Suggests complementary items based on what the customer just added to cart.
 */

export interface UpsellSuggestion {
  message: string;       // e.g. "Why not pair your Tea with…"
  itemNames: string[];   // suggested item names to look up in the menu
  emoji: string;
}

// Category → what to suggest (keywords matched against menu item names)
// Uses partial/fuzzy matching so minor name differences don't break suggestions.
const PAIRINGS: Record<string, UpsellSuggestion> = {
  "Beverages": {
    message: "Tea alone? That's just half the story! 😄 Try our hot Momos —",
    itemNames: ["momos", "nimki", "cabbage pakoda", "aloo pakod"],
    emoji: "🥟",
  },
  "Evening Snacks": {
    message: "🥟 Hot Momos just dropped! 10 pcs, fresh steamed — add",
    itemNames: ["momos", "lime soda", "soft drink"],
    emoji: "🥟",
  },
  "Morning Snacks": {
    message: "🥟 Complete your snack plate! Try our steamed Momos —",
    itemNames: ["momos", "lime soda", "ghuguni"],
    emoji: "🥟",
  },
  "Breakfast Delights": {
    message: "Make it a complete breakfast! Pair with",
    itemNames: ["kakara pitha", "ghuguni", "mitha dahibara", "chakuli pitha"],
    emoji: "☀️",
  },
  "Dosa Corner": {
    message: "Dosa and…? Complete the combo with",
    itemNames: ["mitha dahi", "lime soda", "pahala rasagola", "rasabali"],
    emoji: "🥞",
  },
  "Biryani Zone": {
    message: "🍮 Perfect Odia meal ends with a sweet! Try",
    itemNames: ["chhenapoda", "rasabali", "pahala rasagola", "rasmalai", "malpua", "chhena steam"],
    emoji: "🍮",
  },
  "Dum Zone": {
    message: "🍮 Meal nearly done? End it sweetly with",
    itemNames: ["rasabali", "chhenapoda", "pahala rasagola", "rasmalai", "malpua"],
    emoji: "🍮",
  },
  "Non-Veg Starters": {
    message: "Great starter! Pair it with a hot soup —",
    itemNames: ["hot & sour chicken", "chicken manchow", "veg manchow", "hot & sour veg"],
    emoji: "🍗",
  },
  "Odisha Special": {
    message: "🍮 Authentic Odia meal calls for authentic Odia sweets! Try",
    itemNames: ["chhenapoda", "rasabali", "pahala rasagola", "rasmalai", "chhena steam", "malpua"],
    emoji: "🍮",
  },
  "Thali Corner": {
    message: "🍮 Thali without dessert? Not done! Complete it with",
    itemNames: ["rasabali", "chhenapoda", "pahala rasagola", "rasmalai", "malpua", "chhena steam"],
    emoji: "🍮",
  },
  "Rolls & Momos": {
    message: "🥟 Momos + Soup = best combo! How about a hot",
    itemNames: ["chicken manchow", "hot & sour chicken", "veg manchow", "lime soda"],
    emoji: "🍲",
  },
  "Soups": {
    message: "🥟 Soup + Momos = perfect pair! Add our fresh steamed",
    itemNames: ["momos", "chicken dum biryani", "veg biryani"],
    emoji: "🥟",
  },
  "Fried Rice & Noodles": {
    message: "🍮 Chinese done! End on a sweet note with",
    itemNames: ["rasabali", "chhenapoda", "pahala rasagola", "rasmalai", "malpua"],
    emoji: "🍮",
  },
  "Breads": {
    message: "Breads go best with a rich gravy! How about",
    itemNames: ["chicken manchurian gravy", "veg biryani", "paneer dum biryani", "dal makhani"],
    emoji: "🫓",
  },
  "Sweets": {
    message: "Ending on a sweet note? Why not make it a full meal with",
    itemNames: ["chicken dum biryani", "mutton biryani", "veg dum biryani", "fish thali"],
    emoji: "🍯",
  },
  "Egg Zone": {
    message: "Eggs & Bread — classic! Add",
    itemNames: ["butter naan", "malabar paratha", "butter roti", "garlic butter naan", "garlic naan"],
    emoji: "🥚",
  },
  "North Gravy": {
    message: "Rich gravy + hot bread = perfect! Pair with",
    itemNames: ["butter naan", "garlic butter naan", "malabar paratha", "butter roti"],
    emoji: "🍛",
  },
  "North Spl Gravy": {
    message: "Special gravy deserves special bread! Add",
    itemNames: ["butter naan", "garlic butter naan", "malabar paratha"],
    emoji: "🍛",
  },
};

const DEFAULT_SUGGESTION: UpsellSuggestion = {
  message: "🍮 Don't leave without trying Odisha's finest sweets!",
  itemNames: ["chhenapoda", "rasabali", "pahala rasagola", "rasmalai", "chhena steam", "malpua"],
  emoji: "🍮",
};

/** Match a keyword against a menu item name (case-insensitive partial match) */
function fuzzyMatch(
  keyword: string,
  menuItems: { id: string; name: string; price: number; available: boolean; category: string }[],
  cartItemIds: Set<string>,
) {
  const kw = keyword.toLowerCase();
  return menuItems.find(
    (m) => m.available && !cartItemIds.has(m.id) && m.name.toLowerCase().includes(kw)
  ) ?? null;
}

/** Pick one relevant item from the suggestion list that is actually in the menu */
export function getUpsellSuggestion(
  addedItemCategory: string,
  menuItems: { id: string; name: string; price: number; available: boolean; category: string }[],
  cartItemIds: Set<string>,
): { suggestion: UpsellSuggestion; item: { id: string; name: string; price: number } } | null {
  const rule = PAIRINGS[addedItemCategory] ?? DEFAULT_SUGGESTION;

  // Find available menu items using fuzzy partial matching (not already in cart)
  const candidates = rule.itemNames
    .map((kw) => fuzzyMatch(kw, menuItems, cartItemIds))
    .filter(Boolean) as { id: string; name: string; price: number; category: string }[];

  // Deduplicate by id (multiple keywords can match the same item)
  const seen = new Set<string>();
  const unique = candidates.filter((c) => { if (seen.has(c.id)) return false; seen.add(c.id); return true; });

  if (unique.length === 0) {
    // Fallback: suggest a sweet item not already in cart (never a random main course)
    const fallback = menuItems
      .filter((m) => m.available && !cartItemIds.has(m.id) && m.category === "Sweets")
      .sort(() => Math.random() - 0.5)[0];
    if (!fallback) return null;
    return { suggestion: DEFAULT_SUGGESTION, item: fallback };
  }

  const picked = unique[Math.floor(Math.random() * unique.length)];
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
  // ── Odisha's 4 Star Sweets — equal rotation ──
  { text: "🍮 CHHENAPODA — the ONLY Indian sweet baked in fire! Caramelised cottage cheese, smoky & dense. Made fresh daily 🔥", cta: "Chhenapoda (Sugar)" },
  { text: "🥛 RASABALI — soft chhena patties soaked in thick condensed milk. Melt-in-mouth Odia royalty! Must try 🌟", cta: "Rasabali" },
  { text: "🍡 PAHALA RASAGOLA — the original, authentic Pahala-style! Spongy, juicy & lightly sweet. Not the store-bought kind 😍", cta: "Pahala Rasagola" },
  { text: "🍮 RASMALAI — silky soft chhena discs in chilled saffron milk. Royally delicious! ✨", cta: "Rasmalai" },
  { text: "🍮 Chhenapoda ke liye jagah hamesha hoti hai ❤️ — There is ALWAYS room for Chhenapoda!", cta: "Chhenapoda (Jaggery)" },
  { text: "🥛 Rasabali + Rasagola = the ultimate Odia dessert duo. Both made fresh in-house every day! 🌟", cta: "Rasabali" },
  { text: "🍡 \"Rasagola dekhi kie na kahiba?\" 🤤 Who can say no after seeing Pahala Rasagola? We dare you!", cta: "Pahala Rasagola" },
  { text: "🍮 Rasmalai — light, creamy, chilled. The perfect end to a spicy meal! Try it today 😋", cta: "Rasmalai" },
  { text: "🍮 Sugar Chhenapoda or Jaggery Chhenapoda — can't decide? Add both! Authentic Odisha on your plate 😋", cta: "Chhenapoda (Sugar)" },
  { text: "🏆 Odisha's finest 4: Chhenapoda · Rasabali · Rasagola · Rasmalai — all available right now! 🎉", cta: "Chhenapoda (Sugar)" },
  // ── Other Sweets ──
  { text: "🍰 Chhena Steam — silky smooth, lightly sweet, melt-in-mouth. A hidden classic of Odisha! ✨", cta: "Chhena Steam" },
  { text: "🥞 Malpua — pan-fried sweet pancake with a crispy golden edge & a soft sweet centre. 100% homemade 🍯", cta: "Malpua" },
  // ── Momos promo ──
  { text: "🥟 HOT & FRESH! Chicken Momos — 10 juicy steamed dumplings for just ₹100! Add to your order 🔥", cta: "Chicken Momos (Steamed, 10 pcs)" },
  { text: "🥟 Veg Momos — 10 pcs, soft steamed, served with spicy chutney. Only ₹70! Perfect snack 😍", cta: "Veg Momos (Steamed, 10 pcs)" },
  { text: "🥟 Momos + Hot & Sour Soup = best combo ever! Both available now — try them together!", cta: "Chicken Momos (Steamed, 10 pcs)" },
  // ── Mains & dishes ──
  { text: "🚀 LAUNCH OFFER! Chinese items — Fried Rice & Noodles — 10% OFF auto-applied at checkout! 🔥", cta: "Chicken Fried Rice" },
  { text: "🍜 Craving Chinese? Chicken Hakka Noodles, Fried Rice, Schezwan — 10% OFF auto-applied! 😍", cta: "Chicken Hakka Noodles" },
  { text: "🍛 Slow-cooked Mutton Dum Biryani is flying off tables — try it today!", cta: "Mutton Biryani" },
  { text: "🏆 Chef's pick: Chicken Satay — lightly spiced, perfectly grilled! Most ordered starter!", cta: "Chicken Satay (6 pcs)" },
  { text: "🌟 Soul of Odisha in one bowl — Dahibara Aloodum. Try something truly local today!", cta: "Dahibara Aloodum" },
  { text: "🔥 Hot from the tandoor — Garlic Butter Naan pairs perfectly with any Biryani or gravy.", cta: "Garlic Butter Naan" },
  { text: "🥇 Table favourite: Cabbage Pakoda — crispy, golden, totally addictive! ⭐ Must Try!", cta: "Cabbage Pakoda" },
  { text: "🎉 Feeding a group? Family Pack Biryani (Serves 3) for just ₹510 — best deal in town!", cta: "Chicken Family Pack Dum Biryani (Serves 3)" },
  { text: "🍵 Nimki + Tea = the most satisfying combo ever. Add some to your order!", cta: "Nimki" },
  { text: "🦐 Fresh Bali Prawn — coastal Odia flavour, cooked with love. Only ₹230 for 6 pcs!", cta: "Bali Prawn (6 pcs)" },
  { text: "✨ 'Food tastes better when shared with loved ones.' — Why not order something extra today?", cta: null },
  { text: "🌿 Fresh every day · Sunflower & Mustard Oil only · No compromise on quality ❤️ — Kalinga Bites", cta: null },
];

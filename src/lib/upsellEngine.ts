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
// Strategy:
//   • Starters / Snacks / Soup / Rolls → push Biryani or Chinese as main
//   • Chinese (Fried Rice / Noodles / Manchurian) → complete the Chinese set first, sweets at end
//   • Biryani / Thali / Odia mains → always end with sweets (Chhenapoda, Rasabali, etc.)
//   • Breads / Gravies → pair with Biryani or complete the set
//   • Sweets → nudge toward a main so they extend the meal
const PAIRINGS: Record<string, UpsellSuggestion> = {

  // ── BEVERAGES ──────────────────────────────────────────────────────────────
  "Beverages": {
    message: "🥟 Something to munch with that drink? Try",
    itemNames: ["momos", "nimki", "cabbage pakoda", "singada", "aloo pakodi"],
    emoji: "🥟",
  },

  // ── BREAKFAST ─────────────────────────────────────────────────────────────
  "Odia Breakfast": {
    message: "☀️ Make it a complete Odia breakfast! Add",
    itemNames: ["ghuguni", "mitha dahibara", "kakara pitha", "chakuli pitha", "mitha dahi"],
    emoji: "☀️",
  },
  "North Indian Breakfast": {
    message: "☀️ Chole Bhature + Mitha Dahi = perfect! Add",
    itemNames: ["mitha dahi", "lime soda", "rasabali"],
    emoji: "☀️",
  },
  "Dosa & Idli": {
    message: "🥞 Complete your South Indian plate with",
    itemNames: ["mitha dahi", "lime soda", "rasabali", "pahala rasagola"],
    emoji: "🥞",
  },

  // ── SNACKS & BITES ─────────────────────────────────────────────────────────
  "Savoury Bites": {
    message: "🍛 Snacking? Most customers add a Biryani or Fried Rice too — try",
    itemNames: ["chicken dum biryani", "chicken fried rice", "chicken hakka noodles", "momos"],
    emoji: "🍛",
  },
  "Snacks": {
    message: "🍛 Snacks are just the beginning! Add a proper main —",
    itemNames: ["chicken dum biryani", "chicken fried rice", "veg fried rice", "momos"],
    emoji: "🍛",
  },

  // ── ROLLS & MOMOS → push Biryani / Chinese ─────────────────────────────────
  "Rolls & Momos": {
    message: "🍛 Momos + Biryani = the ultimate combo! Add a",
    itemNames: ["chicken dum biryani", "chicken fried rice", "hot & sour chicken", "veg fried rice"],
    emoji: "🍛",
  },

  // ── SOUPS → complete the Chinese set with Noodles ──────────────────────────
  "Soups": {
    message: "🍜 Soup + Noodles = classic Chinese combo! Add",
    itemNames: ["chicken hakka noodles", "chicken schezwan noodles", "veg hakka noodles", "chicken fried rice"],
    emoji: "🍜",
  },

  // ── CHINESE — cross-sell within the Chinese section ─────────────────────────
  "Fried Rice": {
    message: "🍜 Fried Rice + Noodles or Manchurian = full Chinese feast! Add",
    itemNames: ["chicken hakka noodles", "chicken manchurian gravy", "chicken schezwan noodles", "veg hakka noodles"],
    emoji: "🍜",
  },
  "Noodles": {
    message: "🍛 Noodles + Fried Rice or Manchurian = best Chinese combo! Add",
    itemNames: ["chicken fried rice", "chicken manchurian gravy", "schezwan chicken fried rice", "veg fried rice"],
    emoji: "🍛",
  },
  "Chicken Manchurian": {
    message: "🍜 Manchurian is best with Fried Rice or Noodles! Add",
    itemNames: ["chicken fried rice", "schezwan chicken fried rice", "chicken hakka noodles", "veg fried rice"],
    emoji: "🍜",
  },

  // ── BIRYANI → always end with Odia sweets ─────────────────────────────────
  "Biryani": {
    message: "🍮 Biryani deserves the best dessert! End your meal with",
    itemNames: ["chhenapoda", "rasabali", "pahala rasagola", "rasmalai", "malpua", "chhena steam"],
    emoji: "🍮",
  },

  // ── THALI ──────────────────────────────────────────────────────────────────
  "Thali Corner": {
    message: "🍮 Thali without dessert? Not done! Add",
    itemNames: ["rasabali", "chhenapoda", "pahala rasagola", "rasmalai", "chhena steam"],
    emoji: "🍮",
  },

  // ── STARTERS → push Biryani or Chinese as main ─────────────────────────────
  "Chicken Specials": {
    message: "🍛 Great choice! Most customers add a Biryani or Fried Rice — try",
    itemNames: ["chicken dum biryani", "chicken fried rice", "schezwan chicken fried rice", "kabab biryani"],
    emoji: "🍛",
  },
  "Chicken Grills": {
    message: "🍛 Grilled chicken + Biryani = the perfect non-veg feast! Add",
    itemNames: ["chicken dum biryani", "kabab biryani", "chicken fried rice", "chicken hakka noodles"],
    emoji: "🍛",
  },
  "Fish Starters": {
    message: "🍛 Fish starter pairs perfectly with Biryani or Fried Rice! Add",
    itemNames: ["chicken dum biryani", "chicken fried rice", "schezwan chicken fried rice", "veg fried rice"],
    emoji: "🍛",
  },
  "Prawn Starters": {
    message: "🍛 Prawns + Biryani = coastal royalty! Add",
    itemNames: ["chicken dum biryani", "chicken fried rice", "schezwan chicken fried rice", "kabab biryani"],
    emoji: "🍛",
  },
  "Veg Starters": {
    message: "🍛 Great starter! Add a Fried Rice or Biryani for the full meal —",
    itemNames: ["veg fried rice", "paneer fried rice", "veg dum biryani", "veg hakka noodles"],
    emoji: "🍛",
  },

  // ── ROTI & NAAN → offer Biryani in addition to gravies ─────────────────────
  "Roti & Naan": {
    message: "🍛 Bread + gravy, and maybe a Biryani for the table? Add",
    itemNames: ["chicken dum biryani", "chicken manchurian gravy", "dal makhani", "paneer butter masala"],
    emoji: "🍛",
  },
  "Paratha Corner": {
    message: "🍛 Paratha + gravy = comfort food! Add",
    itemNames: ["dal makhani", "paneer masala", "chicken masala", "mitha dahi"],
    emoji: "🍛",
  },

  // ── EGG ──────────────────────────────────────────────────────────────────
  "Egg Corner": {
    message: "🥚 Egg + Biryani or Fried Rice = a full meal! Add",
    itemNames: ["chicken dum biryani", "chicken fried rice", "butter naan", "garlic butter naan"],
    emoji: "🥚",
  },

  // ── NORTH INDIAN GRAVIES ────────────────────────────────────────────────────
  "North Indian Veg": {
    message: "🍛 Rich gravy + hot Naan + Biryani = the perfect spread! Add",
    itemNames: ["butter naan", "garlic butter naan", "chicken dum biryani", "laccha paratha"],
    emoji: "🍛",
  },
  "Paneer Specials": {
    message: "🍛 Paneer + Naan + Biryani = a feast! Add",
    itemNames: ["butter naan", "garlic butter naan", "paneer fried rice", "laccha paratha"],
    emoji: "🍛",
  },
  "Dal Corner": {
    message: "🍛 Dal + Roti + a side Biryani = the full combo! Add",
    itemNames: ["butter naan", "fulka", "chicken dum biryani", "jeera rice"],
    emoji: "🍛",
  },
  "Aloo Specials": {
    message: "🍛 Aloo sabzi + Naan = soulful! Complete it with",
    itemNames: ["butter naan", "fulka", "laccha paratha", "dal makhani"],
    emoji: "🍛",
  },
  "Kaju Specials": {
    message: "🍛 Rich Kaju gravy + hot Naan = perfect! Add",
    itemNames: ["butter naan", "garlic butter naan", "laccha paratha", "chicken dum biryani"],
    emoji: "🍛",
  },

  // ── ODIA NON-VEG MAINS → Biryani as extra + sweets ─────────────────────────
  "Odia Chicken": {
    message: "🍛 Add a Biryani to complete the feast, or finish sweet with",
    itemNames: ["chicken dum biryani", "kabab biryani", "chhenapoda", "rasabali", "rasmalai"],
    emoji: "🍛",
  },
  "Odia Fish": {
    message: "🍛 Odia fish + Biryani is a legendary combo! Or end sweet with",
    itemNames: ["chicken dum biryani", "chhenapoda", "rasabali", "pahala rasagola", "rasmalai"],
    emoji: "🍛",
  },
  "Odia Mutton": {
    message: "🍛 Khasi Mansa + Biryani = the ultimate non-veg feast! Or try",
    itemNames: ["chicken dum biryani", "kabab biryani", "chhenapoda", "rasabali", "chhena steam"],
    emoji: "🍛",
  },
  "Odia Seafood": {
    message: "🍛 Seafood + Biryani = coastal royalty! Or end sweetly with",
    itemNames: ["chicken dum biryani", "chhenapoda", "rasabali", "pahala rasagola"],
    emoji: "🍛",
  },
  "Patra Poda": {
    message: "🍮 Patra Poda + an Odia sweet = a true feast! End with",
    itemNames: ["chhenapoda", "rasabali", "pahala rasagola", "rasmalai"],
    emoji: "🍮",
  },

  // ── ODIA VEG ────────────────────────────────────────────────────────────────
  "Odia Veg Curries": {
    message: "🍛 Odia veg + Biryani is a great combo! Or finish sweet with",
    itemNames: ["veg dum biryani", "paneer fried rice", "chhenapoda", "rasabali", "rasmalai"],
    emoji: "🍛",
  },
  "Odia Veg Specials": {
    message: "🍮 Complete your Odia veg meal with a sweet! Try",
    itemNames: ["chhenapoda", "rasabali", "pahala rasagola", "rasmalai"],
    emoji: "🍮",
  },

  // ── SWEETS → nudge toward a main to extend the meal ────────────────────────
  "Sweets": {
    message: "🍛 Loving the sweets? Make it a full meal — add a",
    itemNames: ["chicken dum biryani", "chicken fried rice", "veg dum biryani", "chicken thali"],
    emoji: "🍛",
  },

  // ── RICE ──────────────────────────────────────────────────────────────────
  "Rice": {
    message: "🍛 Rice + a rich gravy = the perfect plate! Add",
    itemNames: ["chicken masala", "dal makhani", "paneer masala", "chicken manchurian gravy"],
    emoji: "🍛",
  },
};

// Rotate between three fallback strategies so the default doesn't get stale
const DEFAULT_SUGGESTIONS: UpsellSuggestion[] = [
  {
    message: "🍛 Don't leave without trying our Biryani — slow-cooked, smoky & full of flavour!",
    itemNames: ["chicken dum biryani", "kabab biryani", "boneless biryani", "lollipop biryani"],
    emoji: "🍛",
  },
  {
    message: "🍜 10% OFF on all Chinese items! Fried Rice, Noodles, Manchurian — add one now",
    itemNames: ["chicken fried rice", "chicken hakka noodles", "schezwan chicken fried rice", "veg fried rice"],
    emoji: "🍜",
  },
  {
    message: "🍮 Don't leave without trying Odisha's finest sweets — made fresh daily!",
    itemNames: ["chhenapoda", "rasabali", "pahala rasagola", "rasmalai", "chhena steam", "malpua"],
    emoji: "🍮",
  },
];
// Keep a simple round-robin counter (module-level, resets on server restart — fine for our use)
let defaultIdx = 0;
function getDefaultSuggestion(): UpsellSuggestion {
  const s = DEFAULT_SUGGESTIONS[defaultIdx % DEFAULT_SUGGESTIONS.length];
  defaultIdx++;
  return s;
}

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
  const rule = PAIRINGS[addedItemCategory] ?? getDefaultSuggestion();

  // Find available menu items using fuzzy partial matching (not already in cart)
  const candidates = rule.itemNames
    .map((kw) => fuzzyMatch(kw, menuItems, cartItemIds))
    .filter(Boolean) as { id: string; name: string; price: number; category: string }[];

  // Deduplicate by id (multiple keywords can match the same item)
  const seen = new Set<string>();
  const unique = candidates.filter((c) => { if (seen.has(c.id)) return false; seen.add(c.id); return true; });

  if (unique.length === 0) {
    // Hard fallback chain: Biryani → Chinese → Sweets
    const fallbackCats = ["Biryani", "Fried Rice", "Noodles", "Sweets"];
    for (const cat of fallbackCats) {
      const item = menuItems
        .filter((m) => m.available && !cartItemIds.has(m.id) && m.category === cat)
        .sort(() => Math.random() - 0.5)[0];
      if (item) {
        const def = getDefaultSuggestion();
        return { suggestion: def, item };
      }
    }
    return null;
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
  // ── 🍛 BIRYANI PUSH (high priority — most profitable) ────────────────────
  { text: "🍛 CHICKEN DUM BIRYANI — slow-cooked on dum with whole spices. Smoky, aromatic & absolutely irresistible! ₹200 🔥", cta: "Chicken Dum Biryani" },
  { text: "🎉 Feeding the table? Family Pack Biryani (Serves 3) — ₹510 only! Best value meal in town 😍", cta: "Chicken Family Pack Dum Biryani" },
  { text: "🍛 KABAB BIRYANI — juicy seekh kabab layered with fragrant basmati. Our most special Biryani! ₹250 ✨", cta: "Kabab Biryani" },
  { text: "🍗 LOLLIPOP BIRYANI — crispy chicken lollipops in fragrant rice. A unique must-try! ₹210 🔥", cta: "Lollipop Biryani" },
  { text: "🍛 BONELESS BIRYANI — no bones, all flavour! Perfect for a hassle-free, delicious meal. ₹170 😋", cta: "Boneless Biryani" },
  { text: "🥚 EGG BIRYANI — comfort food at its best! Fluffy egg layered biryani. ₹170 — add it now!", cta: "Egg Biryani" },

  // ── 🍜 CHINESE PUSH (10% off — push hard!) ────────────────────────────────
  { text: "🚀 10% OFF on all Chinese! Fried Rice, Noodles, Manchurian — discount auto-applied at checkout 🔥", cta: "Chicken Fried Rice" },
  { text: "🍜 SCHEZWAN CHICKEN FRIED RICE — fiery Schezwan sauce, tender chicken, wok-tossed to perfection! ₹160 🌶", cta: "Schezwan Chicken Fried Rice" },
  { text: "🍜 CHICKEN HAKKA NOODLES — springy noodles, crisp veggies, tossed in our secret sauce! ₹200 · 10% OFF 😍", cta: "Chicken Hakka Noodles" },
  { text: "🍜 CHICKEN MANCHURIAN GRAVY + Fried Rice = the ultimate Chinese combo! Both 10% off today 🔥", cta: "Chicken Manchurian Gravy" },
  { text: "🌶 SINGAPORE NOODLES — spicy, tangy, loaded with chicken. Our most-ordered noodle dish! ₹220 ✨", cta: "Chicken Singapore Noodles" },
  { text: "🍜 VEG HAKKA NOODLES + VEG FRIED RICE = best veg Chinese combo! Both with 10% off 😋", cta: "Veg Hakka Noodles" },
  { text: "🍗 CHICKEN CHILLY GRAVY — bold Odia-style, finger-licking good! Perfect with Fried Rice 🔥", cta: "Chicken Chilly Gravy" },

  // ── 🍮 SWEETS PUSH ────────────────────────────────────────────────────────
  { text: "🍮 CHHENAPODA — the ONLY Indian sweet baked in fire! Caramelised, smoky, dense. Made fresh daily 🔥", cta: "Chhenapoda (Sugar" },
  { text: "🥛 RASABALI — soft chhena patties in thick condensed milk. Melt-in-mouth Odia royalty! 🌟", cta: "Rasabali" },
  { text: "🍡 PAHALA RASAGOLA — original, authentic, Pahala-style! Spongy, juicy & lightly sweet 😍", cta: "Pahala Rasagola" },
  { text: "🍮 RASMALAI — silky chhena discs in chilled saffron milk. The perfect end to any meal ✨", cta: "Rasmalai" },
  { text: "🏆 Odisha's Fab 4: Chhenapoda · Rasabali · Rasagola · Rasmalai — all made fresh in-house! 🎉", cta: "Chhenapoda (Sugar" },
  { text: "🍰 Chhena Steam — silky, light, melt-in-mouth. A hidden Odia classic worth trying! ✨", cta: "Chhena Steam" },
  { text: "🥞 Malpua — crispy-edged, soft-centred sweet pancake. 100% homemade 🍯 Only ₹40!", cta: "Malpua" },

  // ── 🥟 STARTERS & COMBOS ─────────────────────────────────────────────────
  { text: "🏆 Chef's pick: CHICKEN SATAY — lightly spiced, perfectly grilled! Most ordered starter ⭐", cta: "Chicken Satay" },
  { text: "🥇 Table favourite: CABBAGE PAKODA — crispy, golden, totally addictive! Must Try ⭐", cta: "Cabbage Pakoda" },
  { text: "🥟 HOT & FRESH Chicken Momos — 10 juicy steamed dumplings for ₹100! Add now 🔥", cta: "Chicken Momos (Steamed" },
  { text: "🍵 Nimki + Chai = most satisfying snack combo. Add Nimki to your order! ₹25 only", cta: "Nimki" },
  { text: "🦐 BALI PRAWN — coastal Odia flavour, cooked with love. A must-try Odia classic!", cta: "Bali Prawn" },

  // ── 🎁 RAKSHA BANDHAN PRE-ORDER BANNER ───────────────────────────────────
  { text: "🎀 PSA: Our sweets are SO popular this Raksha Bandhan, even the Rasagolas are nervous. Pre-book yours before they vanish — we're running at FULL capacity! 🔥", cta: null },
  { text: "🚨 BREAKING: Kalinga Bites sweets for Raksha Bandhan are selling faster than excuses on a diet day. Pre-order NOW or explain to your sibling why there's no Chhenapoda 😅", cta: null },
  { text: "🎁 Raksha Bandhan Sweet Pre-Order is LIVE! Reserve Chhenapoda, Rasabali & more before they're gone. Spots are LIMITED — don't wait till the last minute! 😬", cta: null },

  // ── 🌟 BRAND / TRUST TIPS ─────────────────────────────────────────────────
  { text: "🌿 Fresh every day · Sunflower & Mustard Oil only · No compromise on quality ❤️ — Kalinga Bites", cta: null },
  { text: "✨ Tip: The more you order, the more authentic it feels! Why not add one more dish? 😋", cta: null },
];

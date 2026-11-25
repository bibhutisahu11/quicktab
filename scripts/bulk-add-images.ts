/**
 * Bulk image assignment for all menu items — zero API key required!
 *
 * Sources tried in order per item:
 *   1. TheMealDB  — free, no key, covers 300+ dishes
 *   2. Wikipedia  — free, no key, broad coverage
 *   3. Category fallback — Wikipedia search using category name
 *   4. Unsplash   — optional (add UNSPLASH_ACCESS_KEY to .env for best coverage)
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/bulk-add-images.ts
 *
 * Env flags:
 *   DRY_RUN=true   → preview only, no DB writes
 *   OVERWRITE=true → also replace items that already have an image
 *   ITEM_ID=<id>   → only update one specific item (for testing)
 */

import * as dotenv from "dotenv";
dotenv.config();

import { Client } from "pg";

const DRY_RUN    = process.env.DRY_RUN    === "true";
const OVERWRITE  = process.env.OVERWRITE  === "true";
const ONLY_ID    = process.env.ITEM_ID    ?? null;
const UNSPLASH   = process.env.UNSPLASH_ACCESS_KEY ?? "";
const DELAY_MS   = parseInt(process.env.DELAY_MS ?? "600", 10);

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

// ── Name cleanup ──────────────────────────────────────────────────────────────
// Strip noise words, size qualifiers, packaging info so searches are cleaner
function cleanName(raw: string): string {
  return raw
    .replace(/\(.*?\)/g, "")                                     // remove parentheticals
    .replace(/\d+\s*(ml|g|kg|l|ltr)/gi, "")                     // remove quantities
    .replace(/\b(big|small|medium|large|regular|jumbo|mini|family\s*pack|serves\s*\d+)\b/gi, "")
    .replace(/\b(boneless|fry\s*piece|tawa|65|lollipop)\b/gi, "") // common variants
    .replace(/[-–]\s*(big|small|medium|large)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Additional simplified fallback names to try */
function fallbackNames(raw: string): string[] {
  const clean = cleanName(raw);
  const words = clean.split(/\s+/);
  const variants: string[] = [clean];

  // Try last 2-3 words (often the core dish name)
  if (words.length > 3) variants.push(words.slice(-3).join(" "));
  if (words.length > 2) variants.push(words.slice(-2).join(" "));

  // Drop first adjective word
  if (words.length > 2) variants.push(words.slice(1).join(" "));

  return [...new Set(variants)];
}

// ── Category → representative search term ────────────────────────────────────
const CATEGORY_FALLBACK: Record<string, string> = {
  "Biryani":                      "Chicken Biryani Indian",
  "Chicken Manchurian":           "Chicken Manchurian Chinese Indian",
  "Chicken Grills":               "Chicken Tikka grilled Indian",
  "Chicken Specials":             "Indian Chicken Curry",
  "Odia Chicken":                 "Odia Chicken Curry",
  "Odia Fish":                    "Fish Curry Odia",
  "Odia Mutton":                  "Mutton Curry Indian",
  "Odia Seafood":                 "Prawn Curry Indian",
  "Odia Veg Curries":             "Vegetable Curry Indian",
  "Odia Veg Specials":            "Indian Veg Dish",
  "Odia Non-veg Specials":        "Non Veg Indian Thali",
  "Odia Sides":                   "Indian Side Dish",
  "Odia Snacks":                  "Indian Snacks",
  "Odia Breakfast":               "Odia Breakfast",
  "North Indian Veg":             "North Indian Vegetarian",
  "North Indian Non-veg Main Course": "North Indian Chicken",
  "North Indian Breakfast":       "Paratha breakfast",
  "Paneer Specials":              "Paneer Butter Masala",
  "Dal Corner":                   "Dal Makhani",
  "Dosa & Idli":                  "Masala Dosa",
  "South Delights":               "South Indian Food",
  "Paratha Corner":               "Paratha Indian",
  "Savoury Bites":                "Indian Snacks",
  "Veg Starters":                 "Veg Starter Indian",
  "Fish Starters":                "Fish Fry Indian",
  "Prawn Starters":               "Prawn Fry Indian",
  "Egg Corner":                   "Egg Curry Indian",
  "Fried Rice":                   "Fried Rice Chinese",
  "Noodles":                      "Hakka Noodles",
  "Soups":                        "Hot Sour Soup Chinese",
  "Rolls & Momos":                "Momos Dumplings",
  "Thali Corner":                 "Indian Thali",
  "Patra Poda":                   "Indian Cake",
  "Beverages":                    "Indian Tea Coffee",
  "Sweets":                       "Indian Sweets Mithai",
  "Roti & Naan":                  "Naan Bread Indian",
  "Main Course":                  "Indian Main Course",
  "Rice":                         "Steamed Rice",
  "Aloo Specials":                "Aloo Dum Indian",
  "Kaju Specials":                "Kaju Curry Indian",
  "Mutton Specials":              "Mutton Curry",
  "Snacks":                       "Indian Snacks",
  "Light & Healthy":              "Healthy Indian Food",
  "Odisha Packed Snacks":         "Indian Snacks Packaged",
  "Packed Pickles":               "Indian Pickle Achar",
};

// ── Source 1: TheMealDB ───────────────────────────────────────────────────────
async function fromMealDB(name: string): Promise<string | null> {
  for (const variant of fallbackNames(name)) {
    try {
      const res = await fetch(
        `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(variant)}`
      );
      if (!res.ok) continue;
      const data = await res.json() as { meals: { strMealThumb: string }[] | null };
      if (data.meals?.[0]?.strMealThumb) return data.meals[0].strMealThumb;
    } catch { continue; }
    await sleep(100);
  }
  return null;
}

// ── Source 2: Wikipedia ───────────────────────────────────────────────────────
async function fromWikipedia(searchTerm: string): Promise<string | null> {
  try {
    const searchRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchTerm)}&srlimit=1&format=json&origin=*`
    );
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json() as { query: { search: { title: string }[] } };
    const title = searchData.query?.search?.[0]?.title;
    if (!title) return null;

    const pageRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageimages&pithumbsize=600&format=json&origin=*`
    );
    if (!pageRes.ok) return null;
    const pageData = await pageRes.json() as { query: { pages: Record<string, { thumbnail?: { source: string } }> } };
    const page = Object.values(pageData.query?.pages ?? {})[0];
    return page?.thumbnail?.source ?? null;
  } catch { return null; }
}

// ── Source 3: Unsplash (optional) ────────────────────────────────────────────
async function fromUnsplash(term: string): Promise<string | null> {
  if (!UNSPLASH) return null;
  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(term + " food")}&per_page=1&orientation=squarish`,
      { headers: { Authorization: `Client-ID ${UNSPLASH}` } }
    );
    if (res.status === 429) { await sleep(60_000); return fromUnsplash(term); }
    if (!res.ok) return null;
    const data = await res.json() as { results: { urls: { regular: string } }[] };
    return data.results?.[0]?.urls?.regular ?? null;
  } catch { return null; }
}

// ── Try all sources ───────────────────────────────────────────────────────────
async function findImage(name: string, category: string): Promise<{ url: string; source: string } | null> {
  // 1. TheMealDB
  const mealdb = await fromMealDB(name);
  if (mealdb) return { url: mealdb, source: "MealDB" };

  // 2. Wikipedia (item name + cuisine context)
  for (const variant of fallbackNames(name)) {
    await sleep(200);
    const wiki = await fromWikipedia(variant + " Indian food dish");
    if (wiki) return { url: wiki, source: "Wikipedia" };
  }

  // 3. Wikipedia with category fallback term
  const catTerm = CATEGORY_FALLBACK[category] ?? category;
  if (catTerm !== name) {
    await sleep(200);
    const catWiki = await fromWikipedia(catTerm);
    if (catWiki) return { url: catWiki, source: "Wiki-cat" };
  }

  // 4. Unsplash (needs key)
  if (UNSPLASH) {
    await sleep(300);
    const unsplash = await fromUnsplash(cleanName(name));
    if (unsplash) return { url: unsplash, source: "Unsplash" };
  }

  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n🖼️  Bulk image assignment");
  console.log(`   Sources: TheMealDB + Wikipedia + category fallback${UNSPLASH ? " + Unsplash" : ""}`);
  console.log(`   DRY_RUN=${DRY_RUN}  OVERWRITE=${OVERWRITE}  DELAY=${DELAY_MS}ms\n`);

  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();

  let sqlQuery = `SELECT id, name, category, "imageUrl" FROM menu_items`;
  const params: string[] = [];
  if (ONLY_ID) {
    sqlQuery += ` WHERE id = $1`;
    params.push(ONLY_ID);
  } else if (!OVERWRITE) {
    sqlQuery += ` WHERE "imageUrl" IS NULL OR "imageUrl" = ''`;
  }
  sqlQuery += ` ORDER BY category, name`;

  const { rows } = await db.query<{ id: string; name: string; category: string; imageUrl: string | null }>(sqlQuery, params);
  console.log(`📋  ${rows.length} item(s) to process\n`);

  const stats: Record<string, number> = { MealDB: 0, Wikipedia: 0, "Wiki-cat": 0, Unsplash: 0, failed: 0 };

  for (let i = 0; i < rows.length; i++) {
    const item = rows[i];
    const num  = `[${String(i + 1).padStart(3, " ")}/${rows.length}]`;
    process.stdout.write(`${num} ${item.name.padEnd(42)}`);

    const result = await findImage(item.name, item.category);

    if (!result) {
      console.log("❌  not found");
      stats.failed++;
    } else if (DRY_RUN) {
      console.log(`✅ ${result.source.padEnd(10)} ${result.url.slice(0, 55)}…`);
      stats[result.source] = (stats[result.source] ?? 0) + 1;
    } else {
      await db.query(
        `UPDATE menu_items SET "imageUrl" = $1, "updatedAt" = NOW() WHERE id = $2`,
        [result.url, item.id]
      );
      console.log(`✅ ${result.source}`);
      stats[result.source] = (stats[result.source] ?? 0) + 1;
    }

    if (i < rows.length - 1) await sleep(DELAY_MS);
  }

  await db.end();

  const total = rows.length;
  const found = total - (stats.failed ?? 0);
  console.log(`\n${"─".repeat(44)}`);
  console.log(`✅ MealDB     : ${stats.MealDB ?? 0}`);
  console.log(`📖 Wikipedia  : ${stats.Wikipedia ?? 0}`);
  console.log(`🗂️  Wiki-cat   : ${stats["Wiki-cat"] ?? 0}`);
  console.log(`📷 Unsplash   : ${stats.Unsplash ?? 0}`);
  console.log(`❌ Not found  : ${stats.failed ?? 0}`);
  console.log(`${"─".repeat(44)}`);
  console.log(`Coverage      : ${found}/${total} (${Math.round(found / total * 100)}%)`);
  if (DRY_RUN) console.log("\n(Dry run — no DB changes were made)");
  console.log();
}

main().catch((err) => { console.error(err); process.exit(1); });

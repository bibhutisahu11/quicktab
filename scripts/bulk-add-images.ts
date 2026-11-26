/**
 * Bulk Pixabay image assignment for all menu items
 * Pixabay free tier: 5000 req/hour — covers all 453 items in ~2 mins
 *
 * Setup (2 mins, free):
 *   1. Go to https://pixabay.com/api/docs/
 *   2. Click "Get API key" → sign up → key shown instantly
 *   3. Add to .env: PIXABAY_API_KEY="your_key"
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/bulk-add-images.ts
 *
 * Env flags:
 *   DRY_RUN=true   → preview only, no DB writes
 *   OVERWRITE=true → also replace items that already have an image
 *   ITEM_ID=<id>   → only update one specific item
 */

import * as dotenv from "dotenv";
dotenv.config();

import { Client } from "pg";

const DRY_RUN   = process.env.DRY_RUN   === "true";
const OVERWRITE = process.env.OVERWRITE  === "true";
const ONLY_ID   = process.env.ITEM_ID   ?? null;
const KEY       = process.env.PIXABAY_API_KEY ?? "";
const DELAY_MS  = parseInt(process.env.DELAY_MS ?? "300", 10);

if (!KEY) {
  console.error("\n❌  PIXABAY_API_KEY not set in .env");
  console.error("    Get a free key at https://pixabay.com/api/docs/ (instant)\n");
  process.exit(1);
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function buildQuery(name: string, category: string): string {
  const clean = name
    .replace(/\(.*?\)/g, "")
    .replace(/\d+\s*(ml|g|kg|l|ltr|pcs?|pc)\b/gi, "")
    .replace(/\b(big|small|medium|large|regular|jumbo|mini|family\s*pack|serves\s*\d+|half|full|boneless|per\s*piece|per\s*gm|per\s*gram)\b/gi, "")
    .replace(/[-–]\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const cuisine =
    category.toLowerCase().includes("odia") || category.toLowerCase().includes("odisha") ? "Indian food" :
    category.toLowerCase().includes("north indian") ? "North Indian food" :
    category.toLowerCase().includes("chinese") || category.toLowerCase().includes("manchurian") || category.toLowerCase().includes("noodle") || category.toLowerCase().includes("fried rice") ? "Chinese food" :
    category.toLowerCase().includes("south") || category.toLowerCase().includes("dosa") || category.toLowerCase().includes("idli") ? "South Indian food" :
    "Indian food";

  return `${clean} ${cuisine}`;
}

async function searchPixabay(query: string): Promise<string | null> {
  const url = `https://pixabay.com/api/?key=${KEY}&q=${encodeURIComponent(query)}&image_type=photo&orientation=horizontal&per_page=3&safesearch=true&category=food`;
  try {
    const res = await fetch(url);

    if (res.status === 429) {
      console.warn("\n⏳  Rate limited — waiting 65 minutes…");
      await sleep(65 * 60 * 1000);
      return searchPixabay(query);
    }
    if (!res.ok) {
      console.warn(`  ⚠️  Pixabay ${res.status}`);
      return null;
    }

    const data = await res.json() as { hits: { webformatURL: string; largeImageURL: string }[] };
    return data.hits?.[0]?.largeImageURL ?? null;
  } catch {
    return null;
  }
}

async function main() {
  console.log("\n🖼️  Bulk Pexels image assignment");
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

  let updated = 0, failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const item = rows[i];
    const num  = `[${String(i + 1).padStart(3, " ")}/${rows.length}]`;
    const query = buildQuery(item.name, item.category);
    process.stdout.write(`${num} ${item.name.padEnd(44)}`);

    const url = await searchPixabay(query);

    if (!url) {
      console.log("❌");
      failed++;
    } else if (DRY_RUN) {
      console.log(`✅ ${url.slice(0, 60)}…`);
      updated++;
    } else {
      await db.query(
        `UPDATE menu_items SET "imageUrl" = $1, "updatedAt" = NOW() WHERE id = $2`,
        [url, item.id]
      );
      console.log("✅");
      updated++;
    }

    if (i < rows.length - 1) await sleep(DELAY_MS);
  }

  await db.end();

  console.log(`\n${"─".repeat(44)}`);
  console.log(`✅ Updated  : ${updated}`);
  console.log(`❌ Failed   : ${failed}`);
  console.log(`Total       : ${rows.length}`);
  if (DRY_RUN) console.log("\n(Dry run — nothing written to DB)");
  console.log();
}

main().catch((err) => { console.error(err); process.exit(1); });

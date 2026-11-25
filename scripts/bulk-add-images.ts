/**
 * Bulk Unsplash image assignment for all menu items
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
const KEY       = process.env.UNSPLASH_ACCESS_KEY ?? "";
const DELAY_MS  = parseInt(process.env.DELAY_MS ?? "1200", 10);

if (!KEY) {
  console.error("\n❌  UNSPLASH_ACCESS_KEY not set in .env\n");
  process.exit(1);
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

/** Strip noise so searches are focused on the actual dish */
function buildQuery(name: string, category: string): string {
  const clean = name
    .replace(/\(.*?\)/g, "")
    .replace(/\d+\s*(ml|g|kg|l|ltr|pcs?|pc)\b/gi, "")
    .replace(/\b(big|small|medium|large|regular|jumbo|mini|family\s*pack|serves\s*\d+|half|full|boneless|per\s*piece|per\s*gm|per\s*gram)\b/gi, "")
    .replace(/[-–]\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Add cuisine context for better results
  const cuisine =
    category.toLowerCase().includes("odia") || category.toLowerCase().includes("odisha") ? "Odia Indian food" :
    category.toLowerCase().includes("north indian") ? "North Indian food" :
    category.toLowerCase().includes("chinese") || category.toLowerCase().includes("manchurian") || category.toLowerCase().includes("noodle") || category.toLowerCase().includes("fried rice") ? "Chinese Indian food" :
    category.toLowerCase().includes("south") || category.toLowerCase().includes("dosa") || category.toLowerCase().includes("idli") ? "South Indian food" :
    "Indian food dish";

  return `${clean} ${cuisine}`;
}

async function searchUnsplash(query: string): Promise<string | null> {
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=squarish&content_filter=high`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Client-ID ${KEY}` },
    });

    if (res.status === 403 || res.status === 429) {
      console.warn("\n⏳  Rate limited — waiting 65 minutes for quota reset…\n");
      await sleep(65 * 60 * 1000);
      return searchUnsplash(query); // retry after wait
    }
    if (!res.ok) {
      console.warn(`  ⚠️  Unsplash ${res.status}`);
      return null;
    }

    const data = await res.json() as { results: { urls: { regular: string } }[] };
    return data.results?.[0]?.urls?.regular ?? null;
  } catch {
    return null;
  }
}

async function main() {
  console.log("\n🖼️  Bulk Unsplash image assignment");
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

    const url = await searchUnsplash(query);

    if (!url) {
      console.log("❌  not found");
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

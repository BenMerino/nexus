#!/usr/bin/env node
/**
 * One-shot local backfill: repair doi_records.authors entries that were
 * stored as character-keyed objects (e.g. {"0":"H","1":"é",...}) instead
 * of {name: "Héctor"}. Reconstructs the original string from the numeric
 * keys and rewrites each row.
 *
 * Idempotent — rows whose authors are already well-formed are skipped.
 *
 * Usage:  node scripts/backfill-author-names.js
 */

const { Client } = require("pg");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

function isCharBag(a) {
  if (!a || typeof a !== "object") return false;
  if (a.name) return false;
  const keys = Object.keys(a);
  if (keys.length === 0) return false;
  return keys.every(k => /^\d+$/.test(k));
}

function reconstruct(a) {
  const keys = Object.keys(a)
    .filter(k => /^\d+$/.test(k))
    .sort((x, y) => Number(x) - Number(y));
  return keys.map(k => a[k]).join("");
}

function repairAuthors(authors) {
  let changed = false;
  const out = authors.map(a => {
    if (typeof a === "string") return { name: a };
    if (isCharBag(a)) { changed = true; return { name: reconstruct(a) }; }
    return a;
  });
  return { out, changed };
}

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }
  const client = new Client({ connectionString: url });
  await client.connect();

  const { rows } = await client.query("SELECT id, doi, authors FROM doi_records WHERE authors IS NOT NULL");
  console.log(`Scanning ${rows.length} records`);

  let updated = 0;
  let skippedParseError = 0;

  for (const r of rows) {
    let parsed;
    try { parsed = JSON.parse(r.authors); }
    catch { skippedParseError++; continue; }
    if (!Array.isArray(parsed)) continue;

    const { out, changed } = repairAuthors(parsed);
    if (!changed) continue;

    await client.query(
      "UPDATE doi_records SET authors = $1 WHERE id = $2",
      [JSON.stringify(out), r.id],
    );
    updated++;
    console.log(`  ✓ ${r.doi}: repaired ${out.filter((a, i) => parsed[i] !== a).length} authors`);
  }

  console.log(`\nDone. updated=${updated}  parseErrors=${skippedParseError}  total=${rows.length}`);
  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });

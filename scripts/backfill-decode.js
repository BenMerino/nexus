#!/usr/bin/env node
/**
 * One-shot local backfill: decode HTML entities across every doi_records row
 * (title, journal, publisher, abstract, venue, authors JSON) and rebuild
 * tags from raw_responses. Connects directly to Postgres via DATABASE_URL.
 *
 * Usage:  node scripts/backfill-decode.js
 * Idempotent — safe to re-run.
 */

const { Client } = require("pg");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { decodeEntities } = require("../lib/decode-entities");
const { normalize, extractTags, canonicalize } = require("../lib/normalize");

function decodeAuthorsJson(raw) {
  if (!raw) return raw;
  let parsed;
  try { parsed = typeof raw === "string" ? JSON.parse(raw) : raw; }
  catch { return raw; }
  if (!Array.isArray(parsed)) return raw;
  const decoded = parsed.map((a) => ({
    ...a,
    name: decodeEntities(a?.name),
    affiliations: Array.isArray(a?.affiliations)
      ? a.affiliations.map((aff) =>
          typeof aff === "string"
            ? decodeEntities(aff)
            : { ...aff, name: decodeEntities(aff?.name) })
      : a?.affiliations,
  }));
  return JSON.stringify(decoded);
}

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) { console.error("DATABASE_URL not set in .env"); process.exit(1); }
  const client = new Client({ connectionString: url });
  await client.connect();

  const { rows: records } = await client.query("SELECT * FROM doi_records");
  console.log(`Found ${records.length} records`);

  let recordsUpdated = 0;
  let tagsRebuilt = 0;
  let skipped = 0;

  for (const r of records) {
    try {
      await client.query(
        `UPDATE doi_records SET
           title = $1, journal = $2, publisher = $3,
           abstract = $4, venue = $5, authors = $6
         WHERE id = $7`,
        [
          decodeEntities(r.title),
          decodeEntities(r.journal),
          decodeEntities(r.publisher),
          decodeEntities(r.abstract),
          decodeEntities(r.venue),
          decodeAuthorsJson(r.authors),
          r.id,
        ],
      );
      recordsUpdated++;

      if (r.raw_responses) {
        const sources = typeof r.raw_responses === "string"
          ? JSON.parse(r.raw_responses)
          : r.raw_responses;
        const norm = normalize(r.doi, sources);
        const tags = extractTags(norm);

        await client.query("DELETE FROM tags WHERE doi_record_id = $1", [r.id]);
        for (const tag of tags) {
          const finalValue = canonicalize(tag.category, tag.value);
          await client.query(
            `INSERT INTO tags (doi_record_id, category, value, ext_id)
             VALUES ($1, $2, $3, $4)`,
            [r.id, tag.category, finalValue, tag.ext_id || null],
          );
        }
        tagsRebuilt++;
      }
    } catch (e) {
      skipped++;
      console.warn(`  ✗ ${r.doi}: ${e.message}`);
    }
  }

  console.log(`\nDone.  updated=${recordsUpdated}  tagsRebuilt=${tagsRebuilt}  skipped=${skipped}  total=${records.length}`);
  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });

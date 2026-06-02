// Diff-gate: prove the PublicationGovernor/IngestionWorkflow wrap is
// behavior-neutral. Counts entity rows, re-ingests a sample of already-stored
// DOIs through the governed path (fetchAndStore → IngestionWorkflow →
// PublicationGovernor), and re-counts. A wrapper changes nothing, so every
// count must be IDENTICAL before vs after.
//
//   railway ssh --service Nexus "cd /app/apps/api && node scripts/verify-governor-wrap.js [N]"
//
// N = how many existing DOIs to re-ingest (default 25). Re-ingest hits the live
// scholarly APIs, so keep it small. Read-only except the re-ingest itself,
// which is idempotent (delete-then-insert edges).

const { sql } = require("../src/lib/sql");
const { fetchAndStore } = require("../src/lib/store");

const TABLES = [
  "authors", "venues", "institutions",
  "authorship", "published_in", "affiliation", "affiliated_with",
];

// sql.js tagged-template can't interpolate a table name; use sql.query.
async function countOf(table) {
  const r = await sql.query(`SELECT COUNT(*)::int AS c FROM ${table}`, []);
  return Number(r.rows[0].c);
}

async function snapshot() {
  const out = {};
  for (const t of TABLES) out[t] = await countOf(t);
  return out;
}

async function main() {
  const n = parseInt(process.argv[2], 10) || 25;
  const sample = (await sql`
    SELECT doi, submission_id FROM publications
    WHERE doi IS NOT NULL ORDER BY id DESC LIMIT ${n}`).rows;
  console.log(`Sampling ${sample.length} DOIs for re-ingest.`);

  const before = await snapshot();
  let ok = 0, fail = 0;
  for (const r of sample) {
    try { await fetchAndStore(r.doi, r.submission_id); ok++; }
    catch (e) { fail++; console.warn(`  re-ingest failed ${r.doi}: ${e.message}`); }
  }
  const after = await snapshot();

  console.log(`Re-ingested ${ok} ok, ${fail} failed.\n`);
  let drift = false;
  for (const t of TABLES) {
    const d = after[t] - before[t];
    if (d !== 0) drift = true;
    console.log(`  ${t.padEnd(16)} ${String(before[t]).padStart(7)} → ${String(after[t]).padStart(7)}  (${d >= 0 ? "+" : ""}${d})`);
  }
  console.log(`\n${drift ? "❌ DRIFT — the wrap is NOT behavior-neutral" : "✅ NO DRIFT — wrap is behavior-neutral"}`);
  process.exit(drift ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });

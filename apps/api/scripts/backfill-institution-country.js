// Backfill institutions.country (migration 012) from the denormalized
// affiliations JSON, once. Future ingests populate country inline via
// upsertInstitutions; this fills existing rows so the normalized donut join
// works without re-shredding JSON at read time.
//
// Maps aff.ror → institutions.country. An affiliation in the JSON carries both
// `ror` and `country`; we take the most common country seen per ror (a ror's
// country is stable, but guard against stray mismatches by majority).
//
//   railway ssh --service Nexus "cd /app/apps/api && node scripts/backfill-institution-country.js"

const { pool } = require("../src/db/index");
const { normRor } = require("../src/lib/entity-normalize");

async function tenantIds() {
  const r = await pool.query("SELECT DISTINCT tenant_id FROM institutions ORDER BY tenant_id");
  return r.rows.map((x) => x.tenant_id);
}

async function backfillTenant(tenantId) {
  // (ror, country) pairs from the JSON, with occurrence counts → pick the
  // majority country per ror. jsonb unnest is fine here: this runs ONCE.
  const rows = (await pool.query(
    `SELECT aff->>'ror' AS ror, aff->>'country' AS country, COUNT(*) AS n
       FROM publications p,
            jsonb_array_elements(p.affiliations::jsonb) AS author,
            jsonb_array_elements(
              CASE WHEN jsonb_typeof(author->'affiliations') = 'array'
                   THEN author->'affiliations' ELSE '[]'::jsonb END) AS aff
      WHERE p.tenant_id = $1
        AND jsonb_typeof(p.affiliations::jsonb) = 'array'
        AND aff->>'ror' IS NOT NULL AND aff->>'country' IS NOT NULL
      GROUP BY 1, 2`, [tenantId])).rows;

  // ror → country with the highest occurrence count.
  const best = new Map(); // ror -> { country, n }
  for (const r of rows) {
    const ror = normRor(r.ror);
    if (!ror) continue;
    const cur = best.get(ror);
    if (!cur || Number(r.n) > cur.n) best.set(ror, { country: r.country, n: Number(r.n) });
  }

  let updated = 0;
  for (const [ror, { country }] of best) {
    const res = await pool.query(
      `UPDATE institutions SET country = $1
        WHERE ror = $2 AND tenant_id = $3 AND (country IS NULL OR country = '')`,
      [country, ror, tenantId]);
    updated += res.rowCount;
  }
  return { rors: best.size, updated };
}

async function main() {
  for (const t of await tenantIds()) {
    process.stdout.write(`institution country tenant ${t}… `);
    const r = await backfillTenant(t);
    console.log(`done (${r.updated} institutions set from ${r.rors} ror→country pairs)`);
  }
  console.log("Institution country backfill complete.");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

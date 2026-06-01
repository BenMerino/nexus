// Backfill entity + edge tables from existing `tags` (migration Step 2).
//
// IDEMPOTENT (ON CONFLICT DO NOTHING) and re-runnable. SET-BASED: every write is
// a single bulk INSERT…SELECT, so it finishes server-side in seconds even at
// ~500k authorship + ~160k published_in edges (an earlier per-row JS loop was
// too slow and timed out over SSH). Runs per tenant inside withTenant. Never
// touches tags.
//
//   railway ssh --service Nexus "cd /app/apps/api && node scripts/backfill-entities.js"
//   then gate with scripts/reconcile-entities.js (must report zero drift).
//
// Venue canonicalization (collapse journal ISSN-siblings by normalized name
// key — journal-canon) is the one step needing JS (HTML-entity decode). We
// compute name-key→canonical-issn in JS, push it as a temp mapping, and do the
// venue + published_in writes as bulk SQL joined to it.

const { withTenant, pool } = require("../src/db/index");
const { venueKeyToIssn } = require("./entity-normalize");
const { journalNameKey } = require("../src/lib/journal-canon");
const { collectAffiliationEdges } = require("./backfill-affiliation");

async function tenantIds() {
  const r = await pool.query("SELECT DISTINCT tenant_id FROM publications ORDER BY tenant_id");
  return r.rows.map((x) => x.tenant_id);
}

async function backfillTenant(tenantId) {
  await withTenant(tenantId, async (c) => {
    // 1. authors / 2. institutions — distinct normalized identifier, set-based.
    await c.query(`
      INSERT INTO authors (orcid, name, tenant_id)
      SELECT DISTINCT ON (norm) norm, name, $1 FROM (
        SELECT regexp_replace(tg.ext_id,'^https?://orcid\\.org/','') AS norm, tg.value AS name
        FROM tags tg JOIN publications p ON p.id=tg.doi_record_id
        WHERE tg.category='author' AND tg.ext_id IS NOT NULL AND p.tenant_id=$1
      ) s ORDER BY norm ON CONFLICT (orcid, tenant_id) DO NOTHING`, [tenantId]);
    await c.query(`
      INSERT INTO institutions (ror, name, tenant_id)
      SELECT DISTINCT ON (norm) norm, name, $1 FROM (
        SELECT regexp_replace(tg.ext_id,'^https?://ror\\.org/','') AS norm, tg.value AS name
        FROM tags tg JOIN publications p ON p.id=tg.doi_record_id
        WHERE tg.category='institution' AND tg.ext_id IS NOT NULL AND p.tenant_id=$1
      ) s ORDER BY norm ON CONFLICT (ror, tenant_id) DO NOTHING`, [tenantId]);

    // 3. venues — JS-computed name-key→canonical-issn (HTML decode), pushed as a
    //    temp table, then bulk-inserted.
    const vrows = (await c.query(`
      SELECT tg.doi_record_id AS pub, tg.value, tg.ext_id, tg.category FROM tags tg
      JOIN publications p ON p.id=tg.doi_record_id
      WHERE tg.category IN ('journal','non-journal','repository')
        AND tg.ext_id IS NOT NULL AND p.tenant_id=$1`, [tenantId])).rows;
    const venueMap = venueKeyToIssn(vrows); // nameKey → {issn_l,name,venue_type}
    await bulkInsert(c, "venues (issn_l, name, venue_type, tenant_id)",
      [...venueMap.values()].map((v) => [v.issn_l, v.name, v.venue_type, tenantId]),
      "ON CONFLICT (issn_l, tenant_id) DO NOTHING");

    // 4. authorship edges — bulk, joined on normalized ORCID.
    await c.query(`
      INSERT INTO authorship (publication_id, author_id)
      SELECT DISTINCT tg.doi_record_id, a.id
      FROM tags tg JOIN publications p ON p.id=tg.doi_record_id
      JOIN authors a ON a.tenant_id=$1
        AND a.orcid=regexp_replace(tg.ext_id,'^https?://orcid\\.org/','')
      WHERE tg.category='author' AND tg.ext_id IS NOT NULL AND p.tenant_id=$1
      ON CONFLICT DO NOTHING`, [tenantId]);

    // 5. published_in edges — map each journal/repo tag → canonical venue via
    //    the SAME name-key map, then bulk insert (publication_id, venue_id).
    const keyToIssn = new Map();
    for (const v of venueMap.values()) keyToIssn.set(journalNameKey(v.name), v.issn_l);
    const venueIdByIssn = new Map(
      (await c.query(`SELECT id, issn_l FROM venues WHERE tenant_id=$1`, [tenantId])).rows
        .map((r) => [r.issn_l, r.id]));
    const edges = [];
    for (const r of vrows) {
      const venueId = venueIdByIssn.get(keyToIssn.get(journalNameKey(r.value)));
      if (venueId) edges.push([r.pub, venueId]);
    }
    await bulkInsert(c, "published_in (publication_id, venue_id)", dedupePairs(edges), "ON CONFLICT DO NOTHING");

    // 6. affiliation edges (pub↔author↔institution) from the affiliations JSON.
    const affEdges = await collectAffiliationEdges(c, tenantId);
    await bulkInsert(c, "affiliation (publication_id, author_id, institution_id)", affEdges, "ON CONFLICT DO NOTHING");
  });
}

// Generic chunked bulk INSERT … VALUES (pg caps params ~65k; 500 rows/chunk).
async function bulkInsert(c, target, rows, conflict) {
  const cols = (target.match(/\(([^)]+)\)/)[1].split(",").length);
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const vals = chunk.map((_, j) => `(${Array.from({ length: cols }, (_, k) => `$${j*cols+k+1}`).join(",")})`).join(",");
    await c.query(`INSERT INTO ${target} VALUES ${vals} ${conflict}`, chunk.flat());
  }
}
function dedupePairs(pairs) {
  const seen = new Set(); const out = [];
  for (const [a, b] of pairs) { const k = `${a}:${b}`; if (!seen.has(k)) { seen.add(k); out.push([a, b]); } }
  return out;
}

async function main() {
  for (const t of await tenantIds()) {
    process.stdout.write(`backfilling tenant ${t}… `);
    await backfillTenant(t);
    console.log("done");
  }
  console.log("Backfill complete. Run reconcile-entities.js to verify zero drift.");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

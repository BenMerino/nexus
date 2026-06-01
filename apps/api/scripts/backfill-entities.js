// Backfill entity + edge tables from existing `tags` (migration Step 2).
//
// IDEMPOTENT (ON CONFLICT DO NOTHING) and re-runnable. Reads tags + publications,
// writes authors/venues/institutions + authorship/published_in/affiliation.
// Runs per tenant inside withTenant (RLS-ready). Does NOT touch tags.
//
//   DATABASE_URL=... node apps/api/scripts/backfill-entities.js
//
// After running, gate with: node apps/api/scripts/reconcile-entities.js
// (must report zero drift before dual-write / reader migration).

const { withTenant, pool } = require("../src/db/index");
const { normOrcid, normRor, venueKeyToIssn } = require("./entity-normalize");
const { journalNameKey } = require("../src/lib/journal-canon");

async function tenantIds() {
  const r = await pool.query("SELECT DISTINCT tenant_id FROM publications ORDER BY tenant_id");
  return r.rows.map((x) => x.tenant_id);
}

async function backfillTenant(tenantId) {
  await withTenant(tenantId, async (c) => {
    // 1. authors — distinct normalized ORCID (first-seen name wins).
    await c.query(`
      INSERT INTO authors (orcid, name, tenant_id)
      SELECT DISTINCT ON (norm) norm, name, $1 FROM (
        SELECT regexp_replace(tg.ext_id, '^https?://orcid\\.org/', '') AS norm, tg.value AS name
        FROM tags tg JOIN publications p ON p.id = tg.doi_record_id
        WHERE tg.category='author' AND tg.ext_id IS NOT NULL AND p.tenant_id=$1
      ) s ORDER BY norm
      ON CONFLICT (orcid, tenant_id) DO NOTHING`, [tenantId]);

    // 2. institutions — distinct normalized ROR.
    await c.query(`
      INSERT INTO institutions (ror, name, tenant_id)
      SELECT DISTINCT ON (norm) norm, name, $1 FROM (
        SELECT regexp_replace(tg.ext_id, '^https?://ror\\.org/', '') AS norm, tg.value AS name
        FROM tags tg JOIN publications p ON p.id = tg.doi_record_id
        WHERE tg.category='institution' AND tg.ext_id IS NOT NULL AND p.tenant_id=$1
      ) s ORDER BY norm
      ON CONFLICT (ror, tenant_id) DO NOTHING`, [tenantId]);

    // 3. venues — canonical ISSN-L per journal name key (journal-canon collapse).
    const vrows = (await c.query(`
      SELECT tg.value, tg.ext_id, tg.category FROM tags tg
      JOIN publications p ON p.id = tg.doi_record_id
      WHERE tg.category IN ('journal','non-journal','repository')
        AND tg.ext_id IS NOT NULL AND p.tenant_id=$1`, [tenantId])).rows;
    for (const v of venueKeyToIssn(vrows).values()) {
      await c.query(`
        INSERT INTO venues (issn_l, name, venue_type, tenant_id)
        VALUES ($1,$2,$3,$4) ON CONFLICT (issn_l, tenant_id) DO NOTHING`,
        [v.issn_l, v.name, v.venue_type, tenantId]);
    }

    // 4. authorship edges — link each pub to its authors (by normalized ORCID).
    await c.query(`
      INSERT INTO authorship (publication_id, author_id)
      SELECT DISTINCT tg.doi_record_id, a.id
      FROM tags tg JOIN publications p ON p.id = tg.doi_record_id
      JOIN authors a ON a.tenant_id=$1
        AND a.orcid = regexp_replace(tg.ext_id, '^https?://orcid\\.org/', '')
      WHERE tg.category='author' AND tg.ext_id IS NOT NULL AND p.tenant_id=$1
      ON CONFLICT DO NOTHING`, [tenantId]);

    // 5. published_in edges — link each pub to its venue (by canonical name key).
    await backfillPublishedIn(c, tenantId, vrows);
  });
}

// published_in: for each journal/repo tag, resolve its venue via the same name
// key the venue rows were keyed on, then edge pub→venue.
async function backfillPublishedIn(c, tenantId, vrows) {
  const keyToIssn = new Map();
  for (const [, v] of venueKeyToIssn(vrows)) keyToIssn.set(journalNameKey(v.name), v.issn_l);
  const rows = (await c.query(`
    SELECT tg.doi_record_id, tg.value FROM tags tg
    JOIN publications p ON p.id = tg.doi_record_id
    WHERE tg.category IN ('journal','non-journal','repository')
      AND tg.ext_id IS NOT NULL AND p.tenant_id=$1`, [tenantId])).rows;
  for (const r of rows) {
    const issn = keyToIssn.get(journalNameKey(r.value));
    if (!issn) continue;
    await c.query(`
      INSERT INTO published_in (publication_id, venue_id)
      SELECT $1, v.id FROM venues v WHERE v.issn_l=$2 AND v.tenant_id=$3
      ON CONFLICT DO NOTHING`, [r.doi_record_id, issn, tenantId]);
  }
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

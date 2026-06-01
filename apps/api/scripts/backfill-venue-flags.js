// Backfill venues.in_wos/in_scopus/in_doaj/in_scielo from the `indexed_in` tags.
//
// indexed_in tags are (value=Scopus|WoS|DOAJ|SciELO, ext_id=ISSN) per journal —
// the same source data the venue flags are meant to hold. A venue collapses an
// ISSN-sibling set under one name-key, so we match an indexed_in ISSN to a venue
// by JOURNAL NAME-KEY (via the journal tags), not by the single stored issn_l.
// SET-BASED + idempotent: re-running re-derives flags from tags. Per tenant.
//
//   railway ssh --service Nexus "cd /app/apps/api && node scripts/backfill-venue-flags.js"
//
// Foundational step for dropping `tags`: lets the graph derive indexed_in nodes
// from venue flags instead of reading indexed_in tags directly.

const { withTenant, pool } = require("../src/db/index");
const { journalNameKey } = require("../src/lib/journal-canon");
const { SOURCE_TO_FLAG, flagsForNameKeys } = require("../src/lib/venue-flags");

async function tenantIds() {
  const r = await pool.query("SELECT DISTINCT tenant_id FROM publications ORDER BY tenant_id");
  return r.rows.map((x) => x.tenant_id);
}

async function backfillTenant(tenantId) {
  return withTenant(tenantId, async (c) => {
    // ISSN → journal name-key, from this tenant's journal tags.
    const jt = (await c.query(
      `SELECT DISTINCT t.value AS name, t.ext_id AS issn
       FROM tags t JOIN publications p ON p.id = t.doi_record_id
       WHERE t.category='journal' AND t.ext_id IS NOT NULL AND p.tenant_id=$1`, [tenantId])).rows;
    const issnToKey = new Map();
    for (const r of jt) issnToKey.set(r.issn, journalNameKey(r.name));

    // name-key → Set(source) from indexed_in tags (indexation is global, but we
    // only key by ISSNs this tenant actually uses).
    const idx = (await c.query(
      `SELECT DISTINCT value AS src, ext_id AS issn FROM tags WHERE category='indexed_in'`)).rows;
    const keyToSrc = new Map();
    for (const r of idx) {
      const key = issnToKey.get(r.issn);
      if (!key) continue;
      if (!keyToSrc.has(key)) keyToSrc.set(key, new Set());
      keyToSrc.get(key).add(r.src);
    }

    // Apply to venues by name-key. Reset all four flags first so a re-run after a
    // de-indexing correctly clears stale flags (idempotent w.r.t. the source data).
    await c.query(
      `UPDATE venues SET in_wos=FALSE, in_scopus=FALSE, in_doaj=FALSE, in_scielo=FALSE WHERE tenant_id=$1`, [tenantId]);
    const venues = (await c.query(`SELECT id, name FROM venues WHERE tenant_id=$1`, [tenantId])).rows;
    let updated = 0;
    for (const v of venues) {
      const flags = flagsForNameKeys(keyToSrc.get(journalNameKey(v.name)));
      if (!flags) continue;
      await c.query(
        `UPDATE venues SET in_wos=$2, in_scopus=$3, in_doaj=$4, in_scielo=$5 WHERE id=$1`,
        [v.id, flags.in_wos, flags.in_scopus, flags.in_doaj, flags.in_scielo]);
      updated++;
    }
    return updated;
  });
}

async function main() {
  for (const t of await tenantIds()) {
    process.stdout.write(`venue flags tenant ${t}… `);
    const n = await backfillTenant(t);
    console.log(`done (${n} venues flagged)`);
  }
  console.log("Venue-flag backfill complete.");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

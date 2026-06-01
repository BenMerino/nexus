// Backfill venue name_key identity + the ISSN-less venues (migration 007).
//
// Closes the gap that blocked the graph cutover: the entity model only stored
// venues WITH an ISSN, so ~4.9k ISSN-less venues (conferences, books, repos)
// were missing and repository papers couldn't be excluded. This:
//   1. fills name_key on every existing venue (journalNameKey of its name),
//   2. inserts the missing venues (every journal/non-journal/repository tag
//      name-key not yet a venue), keyed by name_key, venue_type by precedence
//      journal > repository > non-journal,
//   3. inserts published_in edges for the newly-minted venues,
//   4. sets publications.is_repository where a repository tag exists.
// Idempotent + per tenant. name-key needs JS (HTML-entity decode) so the venue
// upserts are done from a JS-built map, the edges via a name-key→venue_id join.
//
//   railway ssh --service Nexus "cd /app/apps/api && node scripts/backfill-venues-namekey.js"

const { withTenant, pool } = require("../src/db/index");
const { journalNameKey } = require("../src/lib/journal-canon");
const { entityVenueType } = require("../src/lib/entity-venue-type");

async function tenantIds() {
  const r = await pool.query("SELECT DISTINCT tenant_id FROM publications ORDER BY tenant_id");
  return r.rows.map((x) => x.tenant_id);
}

async function backfillTenant(tenantId) {
  return withTenant(tenantId, async (c) => {
    // 1. name_key on existing venues.
    const venues = (await c.query(`SELECT id, name FROM venues WHERE tenant_id=$1`, [tenantId])).rows;
    for (const v of venues) {
      await c.query(`UPDATE venues SET name_key=$2 WHERE id=$1`, [v.id, journalNameKey(v.name)]);
    }

    // 2. Compute the full venue set from tags: name_key → {name, venue_type, issn_l?}.
    //    venue_type via entityVenueType (journal wins; repository → non-journal,
    //    it is a per-paper property). issn_l = smallest sibling ISSN if any.
    const rows = (await c.query(`
      SELECT t.category, t.value, t.ext_id FROM tags t JOIN publications p ON p.id=t.doi_record_id
      WHERE t.category IN ('journal','non-journal','repository') AND p.tenant_id=$1`, [tenantId])).rows;
    const byKey = new Map();
    for (const r of rows) {
      const key = journalNameKey(r.value);
      if (!key) continue;
      const e = byKey.get(key) || { name: r.value, venue_type: "non-journal", issns: new Set() };
      e.venue_type = entityVenueType(e.venue_type, r.category);
      if (r.category === "journal") e.name = r.value;
      if (r.ext_id) e.issns.add(String(r.ext_id).trim());
      byKey.set(key, e);
    }
    // Upsert EVERY venue (insert missing + RE-TYPE existing — a prior backfill
    // mis-typed multi-category names, e.g. a journal stuck as non-journal).
    let inserted = 0;
    for (const [key, e] of byKey) {
      const issn = e.issns.size ? [...e.issns].sort()[0] : null;
      await c.query(
        `INSERT INTO venues (issn_l, name, name_key, venue_type, tenant_id) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (name_key, tenant_id) DO UPDATE
           SET venue_type = EXCLUDED.venue_type,
               issn_l = COALESCE(venues.issn_l, EXCLUDED.issn_l)`,
        [issn, e.name, key, e.venue_type, tenantId]);
      inserted++;
    }

    // 3. published_in edges via name-key → venue_id join (covers the new venues;
    //    existing journal edges already present from prior backfill, ON CONFLICT).
    const vid = new Map(
      (await c.query(`SELECT id, name_key FROM venues WHERE tenant_id=$1`, [tenantId])).rows
        .map((r) => [r.name_key, r.id]));
    const edgeRows = (await c.query(`
      SELECT DISTINCT t.doi_record_id AS pub, t.value FROM tags t JOIN publications p ON p.id=t.doi_record_id
      WHERE t.category IN ('journal','non-journal','repository') AND p.tenant_id=$1`, [tenantId])).rows;
    const edges = [];
    for (const r of edgeRows) {
      const id = vid.get(journalNameKey(r.value));
      if (id) edges.push([r.pub, id]);
    }
    await bulkInsert(c, "published_in (publication_id, venue_id)", dedupePairs(edges), "ON CONFLICT DO NOTHING");

    // 4. publications.is_repository from the repository tags.
    await c.query(`
      UPDATE publications p SET is_repository = TRUE
      WHERE p.tenant_id=$1 AND EXISTS (
        SELECT 1 FROM tags t WHERE t.doi_record_id=p.id AND t.category='repository')`, [tenantId]);

    // 5. Merge venues that share an ISSN-L into one (e.g. "EPL"/"Europhysics
    //    Letters" both got a name-key row but are one journal). The OLD graph
    //    collapsed these via journalCanonIssn; name-key identity re-split them.
    //    Keep the lowest id, re-point published_in, drop the dups. This is the
    //    VenueGovernor.merge operation, applied here as backfill.
    const dups = (await c.query(`
      SELECT issn_l, array_agg(id ORDER BY id) ids FROM venues
      WHERE tenant_id=$1 AND issn_l IS NOT NULL GROUP BY issn_l HAVING COUNT(*)>1`, [tenantId])).rows;
    let merged = 0;
    for (const d of dups) {
      const [keep, ...drop] = d.ids;
      for (const from of drop) {
        await c.query(`UPDATE published_in SET venue_id=$1 WHERE venue_id=$2
          AND NOT EXISTS (SELECT 1 FROM published_in b WHERE b.venue_id=$1 AND b.publication_id=published_in.publication_id)`, [keep, from]);
        await c.query(`DELETE FROM published_in WHERE venue_id=$1`, [from]);
        await c.query(`DELETE FROM venues WHERE id=$1`, [from]);
        merged++;
      }
    }

    return { inserted, edges: edges.length, merged };
  });
}

async function bulkInsert(c, target, rows, conflict) {
  const cols = target.match(/\(([^)]+)\)/)[1].split(",").length;
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
    process.stdout.write(`venues name_key tenant ${t}… `);
    const r = await backfillTenant(t);
    console.log(`done (${r.inserted} venues upserted, ${r.edges} published_in edges, is_repository set, ${r.merged} ISSN-dup venues merged)`);
  }
  console.log("Venue name_key backfill complete. Re-run diff-graph-entities.js.");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

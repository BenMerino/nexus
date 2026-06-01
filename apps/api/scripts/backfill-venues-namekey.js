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

const RANK = { journal: 3, repository: 2, "non-journal": 1 };

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
    //    venue_type by precedence; issn_l kept if any sibling carried one (smallest).
    const rows = (await c.query(`
      SELECT t.category, t.value, t.ext_id FROM tags t JOIN publications p ON p.id=t.doi_record_id
      WHERE t.category IN ('journal','non-journal','repository') AND p.tenant_id=$1`, [tenantId])).rows;
    const byKey = new Map();
    for (const r of rows) {
      const key = journalNameKey(r.value);
      if (!key) continue;
      const e = byKey.get(key) || { name: r.value, venue_type: r.category, issns: new Set() };
      if (RANK[r.category] > RANK[e.venue_type]) { e.venue_type = r.category; e.name = r.value; }
      if (r.ext_id) e.issns.add(String(r.ext_id).trim());
      byKey.set(key, e);
    }
    // Insert venues missing from the table (existing ones already have name_key).
    const have = new Set(venues.map((v) => journalNameKey(v.name)));
    let inserted = 0;
    for (const [key, e] of byKey) {
      if (have.has(key)) continue;
      const issn = e.issns.size ? [...e.issns].sort()[0] : null;
      await c.query(
        `INSERT INTO venues (issn_l, name, name_key, venue_type, tenant_id) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (name_key, tenant_id) DO NOTHING`, [issn, e.name, key, e.venue_type, tenantId]);
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

    return { inserted, edges: edges.length };
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
    console.log(`done (+${r.inserted} venues, ${r.edges} published_in edges, is_repository set)`);
  }
  console.log("Venue name_key backfill complete. Re-run diff-graph-entities.js.");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

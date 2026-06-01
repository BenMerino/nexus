// Per-record venue dual-write (name-key identity, migration 007). Mirrors
// scripts/backfill-venues-namekey.js for a single ingest: every journal/
// non-journal/repository tag becomes (or reuses) a name-keyed venue, with
// venue_type by precedence and an optional ISSN-L. Sets publications.is_repository
// from the repository tags (the per-paper exclusion signal the graph reads).

const { sql } = require("./sql");
const { journalNameKey } = require("./journal-canon");

const RANK = { journal: 3, repository: 2, "non-journal": 1 };

async function syncVenues(recordId, tenantId, tags) {
  // Collapse this record's venue tags to one entry per name-key.
  const byKey = new Map();
  for (const t of tags) {
    if (!["journal", "non-journal", "repository"].includes(t.category)) continue;
    const key = journalNameKey(t.value);
    if (!key) continue;
    const e = byKey.get(key) || { name: t.value, venue_type: t.category, issns: new Set() };
    if (RANK[t.category] > RANK[e.venue_type]) { e.venue_type = t.category; e.name = t.value; }
    if (t.ext_id) e.issns.add(String(t.ext_id).trim());
    byKey.set(key, e);
  }

  for (const [key, e] of byKey) {
    const issn = e.issns.size ? [...e.issns].sort()[0] : null;
    // Reuse the global venue for this name-key; only set issn_l when we have one
    // and the existing row lacks it (don't clobber a known ISSN with null).
    const v = await sql`
      INSERT INTO venues (issn_l, name, name_key, venue_type, tenant_id)
      VALUES (${issn}, ${e.name}, ${key}, ${e.venue_type}, ${tenantId})
      ON CONFLICT (name_key, tenant_id) DO UPDATE
        SET issn_l = COALESCE(venues.issn_l, EXCLUDED.issn_l),
            name = EXCLUDED.name
      RETURNING id`;
    await sql`INSERT INTO published_in (publication_id, venue_id) VALUES (${recordId}, ${v.rows[0].id})
      ON CONFLICT DO NOTHING`;
  }

  // Per-paper repository-deposit flag (preprint↔published dedup signal).
  const isRepo = tags.some((t) => t.category === "repository");
  if (isRepo) {
    await sql`UPDATE publications SET is_repository = TRUE WHERE id = ${recordId} AND tenant_id = ${tenantId}`;
  }
}

module.exports = { syncVenues };

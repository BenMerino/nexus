// Per-record venue dual-write (name-key identity, migration 007), split by table
// owner for the DGA sole-writer rule:
//   - upsertVenues        → the `venues` table        (VenueGovernor owns)
//   - venuePublishedIn    → the `published_in` edge    (PublicationGovernor owns)
//   - recordIsRepository  → publications.is_repository (PublicationGovernor owns)
//   - applyRecordVenueFlags → venues.in_* flags         (VenueGovernor owns)
// Each is idempotent and uses the same name-key normalization as the backfill.

const { sql } = require("./sql");
const { journalNameKey } = require("./journal-canon");
const { entityVenueType } = require("./entity-venue-type");
const { flagsForNameKeys } = require("./venue-flags");

// Collapse this record's venue tags to one entry per name-key. venue_type is
// journal or non-journal only — "repository" is a PER-PAPER property
// (is_repository), not a venue type, so it maps to non-journal here.
function venuesByKey(tags) {
  const byKey = new Map();
  for (const t of tags) {
    if (!["journal", "non-journal", "repository"].includes(t.category)) continue;
    const key = journalNameKey(t.value);
    if (!key) continue;
    const e = byKey.get(key) || { name: t.value, venue_type: "non-journal", issns: new Set() };
    e.venue_type = entityVenueType(e.venue_type, t.category);
    if (t.category === "journal") e.name = t.value;
    if (t.ext_id) e.issns.add(String(t.ext_id).trim());
    byKey.set(key, e);
  }
  return byKey;
}

// VenueGovernor's write: upsert the `venues` rows for this record's venue tags.
async function upsertVenues(tenantId, tags) {
  for (const [key, e] of venuesByKey(tags)) {
    const issn = e.issns.size ? [...e.issns].sort()[0] : null;
    // Only set issn_l when we have one and the existing row lacks it (don't
    // clobber a known ISSN with null).
    await sql`
      INSERT INTO venues (issn_l, name, name_key, venue_type, tenant_id)
      VALUES (${issn}, ${e.name}, ${key}, ${e.venue_type}, ${tenantId})
      ON CONFLICT (name_key, tenant_id) DO UPDATE
        SET issn_l = COALESCE(venues.issn_l, EXCLUDED.issn_l),
            name = EXCLUDED.name`;
  }
}

// PublicationGovernor's write: link this record to its venues by name-key
// (venues already upserted by VenueGovernor). Edge only.
async function venuePublishedIn(recordId, tenantId, tags) {
  for (const [key] of venuesByKey(tags)) {
    await sql`INSERT INTO published_in (publication_id, venue_id)
      SELECT ${recordId}, id FROM venues WHERE name_key = ${key} AND tenant_id = ${tenantId}
      ON CONFLICT DO NOTHING`;
  }
}

// PublicationGovernor's write: the per-paper repository-deposit flag
// (preprint↔published dedup signal).
async function recordIsRepository(recordId, tenantId, tags) {
  if (tags.some((t) => t.category === "repository")) {
    await sql`UPDATE publications SET is_repository = TRUE WHERE id = ${recordId} AND tenant_id = ${tenantId}`;
  }
}

// VenueGovernor's write: OR this record's indexation sources onto the venues it
// published in (each → its in_* column). Never clears — indexation is a journal
// property accreted across its papers.
async function applyRecordVenueFlags(recordId, tenantId, sources) {
  const flags = flagsForNameKeys(new Set(sources || []));
  if (!flags) return;
  await sql`
    UPDATE venues v SET
      in_wos = v.in_wos OR ${flags.in_wos},
      in_scopus = v.in_scopus OR ${flags.in_scopus},
      in_doaj = v.in_doaj OR ${flags.in_doaj},
      in_scielo = v.in_scielo OR ${flags.in_scielo}
    FROM published_in pi
    WHERE pi.publication_id = ${recordId} AND pi.venue_id = v.id AND v.tenant_id = ${tenantId}`;
}

module.exports = { upsertVenues, venuePublishedIn, recordIsRepository, applyRecordVenueFlags };

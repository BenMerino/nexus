// Per-record entity + edge sync (Step 3 dual-write). The single-record analogue
// of scripts/backfill-entities.js: on every ingest, mirror this publication's
// authors/venues/institutions + authorship/published_in/affiliation edges
// alongside the tag writes, so the entity tables never drift from `tags`.
//
// Uses the same normalization as the backfill (entity-normalize, journal-canon)
// so live writes and the historical backfill agree. Edges are replaced
// (delete-then-insert) to mirror deleteTagsForRecord on re-fetch. Idempotent.

const { sql } = require("./sql");
const { normOrcid, normRor, venueKeyToIssn } = require("./entity-normalize");
const { journalNameKey } = require("./journal-canon");
const { flagsForNameKeys } = require("./venue-flags");

// `record` is the normalized record (record.authors = [{name,orcid,affiliations:
// [{name,ror}]}]); `tags` is extractTags(record). recordId is the publications.id.
async function syncRecordEntities(recordId, tenantId, record, tags) {
  // Replace this record's edges first (re-fetch may change authorship/venue).
  await sql`DELETE FROM authorship WHERE publication_id = ${recordId}`;
  await sql`DELETE FROM published_in WHERE publication_id = ${recordId}`;
  await sql`DELETE FROM affiliation WHERE publication_id = ${recordId}`;
  await sql`DELETE FROM affiliated_with WHERE publication_id = ${recordId}`;

  // Authors + authorship (from author tags: value=name, ext_id=orcid).
  for (const t of tags.filter((x) => x.category === "author" && x.ext_id)) {
    const orcid = normOrcid(t.ext_id);
    const a = await sql`
      INSERT INTO authors (orcid, name, tenant_id) VALUES (${orcid}, ${t.value}, ${tenantId})
      ON CONFLICT (orcid, tenant_id) DO UPDATE SET name = EXCLUDED.name RETURNING id`;
    await sql`INSERT INTO authorship (publication_id, author_id) VALUES (${recordId}, ${a.rows[0].id})
      ON CONFLICT DO NOTHING`;
  }

  // Venues + published_in. A journal is ONE venue identified by its name-key
  // (ISSN siblings collapse). Canonical ISSN-L is a GLOBAL property, so resolve
  // against EXISTING venues by name-key first and reuse — only mint a new venue
  // when this journal isn't already known. (Inserting per-record would create a
  // duplicate venue when this paper's canonical ISSN differs from the stored one.)
  const vmap = venueKeyToIssn(tags.filter((x) => ["journal", "non-journal", "repository"].includes(x.category) && x.ext_id));
  const existing = new Map(
    (await sql`SELECT id, name FROM venues WHERE tenant_id = ${tenantId}`).rows
      .map((r) => [journalNameKey(r.name), r.id]));
  for (const v of vmap.values()) {
    const key = journalNameKey(v.name);
    let venueId = existing.get(key);
    if (!venueId) {
      const r = await sql`
        INSERT INTO venues (issn_l, name, venue_type, tenant_id) VALUES (${v.issn_l}, ${v.name}, ${v.venue_type}, ${tenantId})
        ON CONFLICT (issn_l, tenant_id) DO UPDATE SET name = EXCLUDED.name RETURNING id`;
      venueId = r.rows[0].id;
      existing.set(key, venueId);
    }
    await sql`INSERT INTO published_in (publication_id, venue_id) VALUES (${recordId}, ${venueId})
      ON CONFLICT DO NOTHING`;
  }

  // Venue indexation flags. indexed_in tags for this record were written just
  // before (tagIndexationForRecord) — fold their sources onto each venue this
  // record published in. Indexation is a journal property, so OR the flags in
  // (never clear) so siblings/other papers don't reset a known index.
  await syncVenueFlags(recordId, tenantId);

  // Direct pub↔institution edges from institution TAGS (any ROR, ORCID or not).
  for (const t of tags.filter((x) => x.category === "institution" && x.ext_id)) {
    const ror = normRor(t.ext_id);
    const inst = await sql`
      INSERT INTO institutions (ror, name, tenant_id) VALUES (${ror}, ${t.value || ror}, ${tenantId})
      ON CONFLICT (ror, tenant_id) DO UPDATE SET name = EXCLUDED.name RETURNING id`;
    await sql`INSERT INTO affiliated_with (publication_id, institution_id)
      VALUES (${recordId}, ${inst.rows[0].id}) ON CONFLICT DO NOTHING`;
  }

  // Author-mediated affiliation (pub↔author↔institution) from the JSON.
  await syncAffiliations(recordId, tenantId, record);
}

// OR this record's indexed_in sources onto the venues it published in. The
// indexed_in tags (value=Scopus|WoS|DOAJ|SciELO) were just written for this
// record; map them to the in_* columns via venue-flags and set them true. Never
// clears a flag — indexation is a journal property accreted across its papers.
async function syncVenueFlags(recordId, tenantId) {
  const srcRows = (await sql`
    SELECT DISTINCT value FROM tags WHERE doi_record_id = ${recordId} AND category = 'indexed_in'`).rows;
  const flags = flagsForNameKeys(new Set(srcRows.map((r) => r.value)));
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

async function syncAffiliations(recordId, tenantId, record) {
  const authors = Array.isArray(record.authors) ? record.authors : [];
  for (const a of authors) {
    if (!a?.orcid || !Array.isArray(a.affiliations)) continue;
    const orcid = normOrcid(a.orcid);
    const au = await sql`SELECT id FROM authors WHERE orcid = ${orcid} AND tenant_id = ${tenantId}`;
    if (!au.rows[0]) continue;
    for (const aff of a.affiliations) {
      const ror = aff && typeof aff === "object" ? normRor(aff.ror) : null;
      if (!ror) continue;
      const inst = await sql`
        INSERT INTO institutions (ror, name, tenant_id) VALUES (${ror}, ${aff.name || ror}, ${tenantId})
        ON CONFLICT (ror, tenant_id) DO UPDATE SET name = EXCLUDED.name RETURNING id`;
      await sql`INSERT INTO affiliation (publication_id, author_id, institution_id)
        VALUES (${recordId}, ${au.rows[0].id}, ${inst.rows[0].id}) ON CONFLICT DO NOTHING`;
    }
  }
}

// Entity resolution: merge institution `fromId` INTO `intoId`. Re-points the
// variant's affiliation edges to the canonical institution (dedupe via ON
// CONFLICT) and deletes the variant row. The primitive InstitutionGovernor.merge
// will call; used now to apply the human institution-synonym judgments into the
// entity model. Idempotent (a second call no-ops once fromId is gone).
async function mergeInstitution(fromId, intoId) {
  if (fromId === intoId) return;
  await sql`UPDATE affiliation SET institution_id = ${intoId}
    WHERE institution_id = ${fromId}
      AND NOT EXISTS (
        SELECT 1 FROM affiliation b WHERE b.institution_id = ${intoId}
          AND b.publication_id = affiliation.publication_id
          AND b.author_id = affiliation.author_id)`;
  await sql`DELETE FROM affiliation WHERE institution_id = ${fromId}`;
  // also re-point the direct pub↔institution edges, then drop the variant's
  await sql`UPDATE affiliated_with SET institution_id = ${intoId}
    WHERE institution_id = ${fromId}
      AND NOT EXISTS (
        SELECT 1 FROM affiliated_with b WHERE b.institution_id = ${intoId}
          AND b.publication_id = affiliated_with.publication_id)`;
  await sql`DELETE FROM affiliated_with WHERE institution_id = ${fromId}`;
  await sql`DELETE FROM institutions WHERE id = ${fromId}`;
}

module.exports = { syncRecordEntities, mergeInstitution };

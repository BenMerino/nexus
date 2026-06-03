// Per-record entity + edge writes, split by table owner for the DGA sole-writer
// rule (DGA_DESIGN §35). Each governor owns its own table; PublicationGovernor
// owns only the edges (its aggregate's write-once children):
//   - upsertAuthors       → `authors`        (AuthorGovernor)
//   - upsertInstitutions  → `institutions`   (InstitutionGovernor)
//   - linkRecordEdges     → authorship / published_in / affiliated_with /
//                           affiliation / published_in / is_repository
//                           (PublicationGovernor — links by natural key)
// Venue table + flag writes live in db-venues-sync.js (VenueGovernor). Edges are
// replaced (delete-then-insert) to mirror a re-fetch. All idempotent; same
// normalization as the backfill so live writes and historical backfill agree.

const { sql } = require("./sql");
const { normOrcid, normRor } = require("./entity-normalize");
const { venuePublishedIn, recordIsRepository } = require("./db-venues-sync");

// ── AuthorGovernor's write: `authors` rows from author tags (value=name,
// ext_id=orcid). Idempotent by (orcid, tenant_id). ──
async function upsertAuthors(tenantId, tags) {
  for (const t of tags.filter((x) => x.category === "author" && x.ext_id)) {
    const orcid = normOrcid(t.ext_id);
    await sql`
      INSERT INTO authors (orcid, name, tenant_id) VALUES (${orcid}, ${t.value}, ${tenantId})
      ON CONFLICT (orcid, tenant_id) DO UPDATE SET name = EXCLUDED.name`;
  }
}

// ── InstitutionGovernor's write: `institutions` rows. Two sources, same as the
// legacy sync: (a) institution tags (any ROR), (b) author-mediated affiliations
// in the record JSON. Idempotent by (ror, tenant_id). ──
async function upsertInstitutions(tenantId, tags, record) {
  for (const t of tags.filter((x) => x.category === "institution" && x.ext_id)) {
    const ror = normRor(t.ext_id);
    await sql`
      INSERT INTO institutions (ror, name, tenant_id) VALUES (${ror}, ${t.value || ror}, ${tenantId})
      ON CONFLICT (ror, tenant_id) DO UPDATE SET name = EXCLUDED.name`;
  }
  for (const a of Array.isArray(record.authors) ? record.authors : []) {
    if (!a?.orcid || !Array.isArray(a.affiliations)) continue;
    for (const aff of a.affiliations) {
      const ror = aff && typeof aff === "object" ? normRor(aff.ror) : null;
      if (!ror) continue;
      // Normalize country onto the institution (the donut's source — replaces
      // shredding the affiliations JSON at read time). COALESCE on conflict so
      // a later record lacking country never clears a known one.
      const country = aff.country || null;
      await sql`
        INSERT INTO institutions (ror, name, country, tenant_id) VALUES (${ror}, ${aff.name || ror}, ${country}, ${tenantId})
        ON CONFLICT (ror, tenant_id) DO UPDATE SET name = EXCLUDED.name, country = COALESCE(institutions.country, EXCLUDED.country)`;
    }
  }
}

// ── PublicationGovernor's write: this record's edges. Entities (authors,
// venues, institutions) are already upserted by their governors; here we only
// (re)link by natural key. Replace edges first (a re-fetch may change them). ──
async function linkRecordEdges(recordId, tenantId, record, tags) {
  await sql`DELETE FROM authorship WHERE publication_id = ${recordId}`;
  await sql`DELETE FROM published_in WHERE publication_id = ${recordId}`;
  await sql`DELETE FROM affiliation WHERE publication_id = ${recordId}`;
  await sql`DELETE FROM affiliated_with WHERE publication_id = ${recordId}`;

  // authorship (paper↔author, by orcid).
  for (const t of tags.filter((x) => x.category === "author" && x.ext_id)) {
    await sql`INSERT INTO authorship (publication_id, author_id)
      SELECT ${recordId}, id FROM authors WHERE orcid = ${normOrcid(t.ext_id)} AND tenant_id = ${tenantId}
      ON CONFLICT DO NOTHING`;
  }

  // published_in (paper↔venue, by name-key) + per-paper is_repository flag.
  await venuePublishedIn(recordId, tenantId, tags);
  await recordIsRepository(recordId, tenantId, tags);

  // affiliated_with (paper↔institution direct, by ror).
  for (const t of tags.filter((x) => x.category === "institution" && x.ext_id)) {
    await sql`INSERT INTO affiliated_with (publication_id, institution_id)
      SELECT ${recordId}, id FROM institutions WHERE ror = ${normRor(t.ext_id)} AND tenant_id = ${tenantId}
      ON CONFLICT DO NOTHING`;
  }

  // affiliation (paper↔author↔institution, author-mediated, by orcid+ror).
  for (const a of Array.isArray(record.authors) ? record.authors : []) {
    if (!a?.orcid || !Array.isArray(a.affiliations)) continue;
    const orcid = normOrcid(a.orcid);
    for (const aff of a.affiliations) {
      const ror = aff && typeof aff === "object" ? normRor(aff.ror) : null;
      if (!ror) continue;
      await sql`INSERT INTO affiliation (publication_id, author_id, institution_id)
        SELECT ${recordId}, au.id, inst.id
          FROM authors au, institutions inst
          WHERE au.orcid = ${orcid} AND au.tenant_id = ${tenantId}
            AND inst.ror = ${ror} AND inst.tenant_id = ${tenantId}
        ON CONFLICT DO NOTHING`;
    }
  }
}

// Author claim: bind a researcher (by ORCID) to a publication as an authorship
// edge. Upserts the author (name only set if creating; never clobbers a richer
// existing name) and the authorship edge. Returns { created } when newly added.
async function claimAuthorship(publicationId, tenantId, orcidRaw, name) {
  const orcid = normOrcid(orcidRaw);
  const a = await sql`
    INSERT INTO authors (orcid, name, tenant_id) VALUES (${orcid}, ${name || orcid}, ${tenantId})
    ON CONFLICT (orcid, tenant_id) DO UPDATE SET name = COALESCE(authors.name, EXCLUDED.name) RETURNING id`;
  const r = await sql`INSERT INTO authorship (publication_id, author_id)
    VALUES (${publicationId}, ${a.rows[0].id}) ON CONFLICT DO NOTHING`;
  return { created: r.rowCount > 0 };
}

// Institution merges live in db-institution-merge.js; re-exported so existing
// importers from db-entities keep working.
const { mergeInstitution, mergeInstitutionSynonym } = require("./db-institution-merge");

module.exports = {
  upsertAuthors, upsertInstitutions, linkRecordEdges,
  claimAuthorship, mergeInstitution, mergeInstitutionSynonym,
};

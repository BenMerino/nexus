// Per-record entity + edge sync (Step 3 dual-write). The single-record analogue
// of scripts/backfill-entities.js: on every ingest, mirror this publication's
// authors/venues/institutions + authorship/published_in/affiliation edges
// alongside the tag writes, so the entity tables never drift from `tags`.
//
// Uses the same normalization as the backfill (entity-normalize, journal-canon)
// so live writes and the historical backfill agree. Edges are replaced
// (delete-then-insert) to mirror deleteTagsForRecord on re-fetch. Idempotent.

const { sql } = require("./sql");
const { normOrcid, normRor } = require("./entity-normalize");
const { flagsForNameKeys } = require("./venue-flags");
const { syncVenues } = require("./db-venues-sync");
const { indexationForIssn } = require("./indexed-journals");

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

  // Venues + published_in. A venue's identity is its name-key (ISSN optional);
  // ISSN-less venues (conferences/books/repos) get a synthetic name-keyed row.
  // venue_type by precedence (journal > repository > non-journal). is_repository
  // is set as a per-paper publication property (the exclusion signal).
  await syncVenues(recordId, tenantId, tags);

  // Venue indexation flags — sourced DIRECTLY from the indexation map (the same
  // source the legacy indexed_in tags came from), not from tags. OR the flags
  // onto each venue this record published in. Indexation is a journal property,
  // so OR in (never clear) so siblings/other papers don't reset a known index.
  const sources = await indexationForIssn(record.issnL);
  await syncVenueFlags(recordId, tenantId, sources);

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

// OR this record's indexation sources (Scopus|WoS|DOAJ|SciELO, from the
// indexation map) onto the venues it published in — mapping each to its in_*
// column. Never clears a flag — indexation is a journal property accreted
// across its papers.
async function syncVenueFlags(recordId, tenantId, sources) {
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

// Author claim: bind a researcher (by ORCID) to a publication as an authorship
// edge — the entity form of the legacy author-tag claim. Upserts the author
// (name only set if creating; never clobbers a richer existing name) and the
// authorship edge. Returns { created } = true when the edge was newly added.
async function claimAuthorship(publicationId, tenantId, orcidRaw, name) {
  const orcid = normOrcid(orcidRaw);
  const a = await sql`
    INSERT INTO authors (orcid, name, tenant_id) VALUES (${orcid}, ${name || orcid}, ${tenantId})
    ON CONFLICT (orcid, tenant_id) DO UPDATE SET name = COALESCE(authors.name, EXCLUDED.name) RETURNING id`;
  const r = await sql`INSERT INTO authorship (publication_id, author_id)
    VALUES (${publicationId}, ${a.rows[0].id}) ON CONFLICT DO NOTHING`;
  return { created: r.rowCount > 0 };
}

// Institution merges moved to db-institution-merge.js (own concern); re-exported
// here so existing importers of mergeInstitution / mergeInstitutionSynonym from
// db-entities keep working unchanged.
const { mergeInstitution, mergeInstitutionSynonym } = require("./db-institution-merge");

module.exports = { syncRecordEntities, mergeInstitution, mergeInstitutionSynonym, claimAuthorship };

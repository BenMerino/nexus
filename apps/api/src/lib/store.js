const { upsertRecord, getRecordByDoi } = require("./db");
const { normalize, extractTags, canonicalize } = require("./normalize");
const { fetchCrossRef, fetchOpenAlex, fetchSemanticScholar, fetchDataCite, unwrap } = require("./fetchers");
const { upsertCitationsByYear, upsertConcepts, deleteConceptsForRecord } = require("./db-portfolio");
const { extractKeywords } = require("./nlp-keywords");
const { syncRecordEntities } = require("./db-entities");
const { sql } = require("./sql");

async function fetchAndStore(doi, submissionId) {
  const results = await Promise.allSettled([
    fetchCrossRef(doi), fetchOpenAlex(doi), fetchSemanticScholar(doi), fetchDataCite(doi),
  ]);
  const sources = {
    crossref: unwrap(results[0]), openalex: unwrap(results[1]),
    semanticScholar: unwrap(results[2]), datacite: unwrap(results[3]),
  };
  const record = normalize(doi, sources);

  await upsertRecord(
    submissionId, record.doi, record.title,
    record.authorNames ? JSON.stringify(record.authorNames) : null,
    record.published, record.journal, record.publisher, record.type,
    record.citationCount, record.openAccess || false, record.openAccessUrl,
    record.abstract, record.venue, record.url,
    record.authors ? JSON.stringify(record.authors) : null,
    JSON.stringify(sources)
  );

  const dbRecord = await getRecordByDoi(record.doi);
  // The `tags` table is no longer written (P5) — entities are the sole store.
  // extractTags still runs because syncRecordEntities derives the entity writes
  // (authors/venues/institutions + edges) from this canonical tag-shaped array.
  const tags = extractTags(record);

  // Write entities + edges from the tag-shaped array. Uses canonicalized values.
  const canonTags = tags.map((t) => ({ ...t, value: canonicalize(t.category, t.value) }));
  const tRow = await sql`SELECT tenant_id FROM publications WHERE id = ${dbRecord.id}`;
  await syncRecordEntities(dbRecord.id, tRow.rows[0]?.tenant_id ?? 1, record, canonTags);

  await upsertCitationsByYear(dbRecord.id, record.countsByYear);
  await deleteConceptsForRecord(dbRecord.id);
  await upsertConcepts(dbRecord.id, record.concepts);
  if (record.abstract) {
    await upsertConcepts(dbRecord.id, extractKeywords(record.abstract));
  }

  return { record, sources, tags };
}

module.exports = { fetchAndStore };

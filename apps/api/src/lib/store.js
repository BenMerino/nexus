const { normalize, extractTags } = require("./normalize");
const { fetchCrossRef, fetchOpenAlex, fetchSemanticScholar, fetchDataCite, unwrap } = require("./fetchers");
const { upsertCitationsByYear, upsertConcepts, deleteConceptsForRecord } = require("./db-portfolio");
const { extractKeywords } = require("./nlp-keywords");
const { systemActor } = require("../substrate/actor");
const { ingestionWorkflow } = require("../services/ingestion/IngestionWorkflow");

async function fetchAndStore(doi, submissionId) {
  const results = await Promise.allSettled([
    fetchCrossRef(doi), fetchOpenAlex(doi), fetchSemanticScholar(doi), fetchDataCite(doi),
  ]);
  const sources = {
    crossref: unwrap(results[0]), openalex: unwrap(results[1]),
    semanticScholar: unwrap(results[2]), datacite: unwrap(results[3]),
  };
  const record = normalize(doi, sources);

  // The paper row + all entity edges (authors/venues/institutions + edges +
  // venue flags) are now the publication aggregate's governed write, driven
  // through the IngestionWorkflow → PublicationGovernor (the sole writer).
  const dbId = await ingestionWorkflow.run(systemActor(1), { submissionId, record, sources });

  // Citations / concepts / keywords are not part of the publication aggregate's
  // edge sync — they stay here (portfolio-stat tables, written as before).
  await upsertCitationsByYear(dbId, record.countsByYear);
  await deleteConceptsForRecord(dbId);
  await upsertConcepts(dbId, record.concepts);
  if (record.abstract) {
    await upsertConcepts(dbId, extractKeywords(record.abstract));
  }

  // `tags` in the return is the post-ingest tag-chip preview the submit UI
  // renders (admin-doi-submit.js); the `tags` TABLE is gone (P5), this array
  // is computed for display only and never persisted.
  return { record, sources, tags: extractTags(record) };
}

module.exports = { fetchAndStore };

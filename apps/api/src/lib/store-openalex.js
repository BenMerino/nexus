const { insertSubmission } = require("./db");
const { normalizeWork } = require("./normalize-openalex");
const { systemActor } = require("../substrate/actor");
const { ingestionWorkflow } = require("../services/ingestion/IngestionWorkflow");

async function importWorksBatch(works, uploader) {
  const results = { imported: 0, skipped: 0, errors: [] };
  for (const work of works) {
    try {
      const record = normalizeWork(work);
      if (!record) { results.skipped++; continue; }
      await storeNormalizedRecord(record, uploader);
      results.imported++;
    } catch (err) {
      results.errors.push({ doi: work.doi, error: err.message });
    }
  }
  return results;
}

async function storeNormalizedRecord(record, uploader) {
  const subId = await insertSubmission(record.doi, uploader);
  // Paper row + all entity edges are the publication aggregate's governed
  // write, driven through the IngestionWorkflow → PublicationGovernor.
  await ingestionWorkflow.run(systemActor(1), { submissionId: subId, record, sources: { openalex: record } });
}

module.exports = { importWorksBatch };

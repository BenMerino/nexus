const { insertSubmission, upsertRecord, getRecordByDoi, insertTag, deleteTagsForRecord } = require("./db");
const { normalizeWork } = require("./normalize-openalex");
const { extractTags, canonicalize } = require("./normalize-tags");
const { tagIndexationForRecord } = require("./indexed-backfill");

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
  await upsertRecord(
    subId, record.doi, record.title,
    record.authorNames ? JSON.stringify(record.authorNames) : null,
    record.published, record.journal, record.publisher, record.type,
    record.citationCount, record.openAccess, record.openAccessUrl,
    record.abstract, record.venue, record.url,
    record.authors ? JSON.stringify(record.authors) : null,
    JSON.stringify({ openalex: record })
  );
  const dbRec = await getRecordByDoi(record.doi);
  await deleteTagsForRecord(dbRec.id);
  const tags = extractTags(record);
  for (const tag of tags) {
    await insertTag(dbRec.id, tag.category, canonicalize(tag.category, tag.value));
  }
  await tagIndexationForRecord(dbRec.id, record.issnL);
  for (const src of record.sourceIndices || []) {
    await insertTag(dbRec.id, "source", src, null);
  }
}

module.exports = { importWorksBatch };

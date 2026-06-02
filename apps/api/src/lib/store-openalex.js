const { insertSubmission, upsertRecord, getRecordByDoi } = require("./db");
const { normalizeWork } = require("./normalize-openalex");
const { extractTags, canonicalize } = require("./normalize-tags");
const { syncRecordEntities } = require("./db-entities");
const { sql } = require("./sql");

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
  // The `tags` table is no longer written (P5). extractTags still runs because
  // syncRecordEntities derives the entity writes from this tag-shaped array.
  const tags = extractTags(record);

  // Write entities + edges from the tag-shaped array.
  const canonTags = tags.map((t) => ({ ...t, value: canonicalize(t.category, t.value) }));
  const tRow = await sql`SELECT tenant_id FROM publications WHERE id = ${dbRec.id}`;
  await syncRecordEntities(dbRec.id, tRow.rows[0]?.tenant_id ?? 1, record, canonTags);
}

module.exports = { importWorksBatch };

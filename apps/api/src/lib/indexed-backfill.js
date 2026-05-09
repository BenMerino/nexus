const { sql } = require("./sql");
const { getIndexationMap, indexationForIssn } = require("./indexed-journals");

async function tagIndexationForRecord(recordId, issnL) {
  if (!recordId || !issnL) return [];
  const sources = await indexationForIssn(issnL);
  for (const src of sources) {
    await sql`INSERT INTO tags (doi_record_id, category, value, ext_id)
      VALUES (${recordId}, 'indexed_in', ${src}, ${issnL})`;
  }
  return sources;
}

async function backfillIndexationTags() {
  const map = await getIndexationMap();
  if (!map.size) return { scanned: 0, tagged: 0 };

  const journalTags = await sql`
    SELECT doi_record_id, ext_id FROM tags
    WHERE category = 'journal' AND ext_id IS NOT NULL`;

  const existing = await sql`
    SELECT doi_record_id, value FROM tags WHERE category = 'indexed_in'`;
  const haveByRecord = new Map();
  for (const row of existing.rows) {
    if (!haveByRecord.has(row.doi_record_id)) haveByRecord.set(row.doi_record_id, new Set());
    haveByRecord.get(row.doi_record_id).add(row.value);
  }

  let tagged = 0;
  for (const row of journalTags.rows) {
    const sources = map.get(row.ext_id);
    if (!sources || !sources.length) continue;
    const have = haveByRecord.get(row.doi_record_id) || new Set();
    for (const src of sources) {
      if (have.has(src)) continue;
      await sql`INSERT INTO tags (doi_record_id, category, value, ext_id)
        VALUES (${row.doi_record_id}, 'indexed_in', ${src}, ${row.ext_id})`;
      tagged++;
    }
  }
  return { scanned: journalTags.rows.length, tagged };
}

async function clearIndexationTagsForSource(source) {
  await sql`DELETE FROM tags WHERE category = 'indexed_in' AND value = ${source}`;
}

module.exports = { backfillIndexationTags, clearIndexationTagsForSource, tagIndexationForRecord };

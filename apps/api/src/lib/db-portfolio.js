const { sql } = require("./sql");

async function upsertCitationsByYear(recordId, rows) {
  if (!recordId || !rows?.length) return;
  await sql`DELETE FROM doi_citations_by_year WHERE doi_record_id = ${recordId}`;
  for (const r of rows) {
    if (r.year == null || r.count == null) continue;
    await sql`
      INSERT INTO doi_citations_by_year (doi_record_id, year, count)
      VALUES (${recordId}, ${r.year}, ${r.count})
      ON CONFLICT (doi_record_id, year) DO UPDATE SET count = EXCLUDED.count`;
  }
}

async function upsertConcepts(recordId, rows) {
  if (!recordId || !rows?.length) return;
  for (const c of rows) {
    if (!c.id || !c.display_name) continue;
    await sql`
      INSERT INTO doi_concepts (doi_record_id, concept_id, display_name, source, level, score)
      VALUES (${recordId}, ${c.id}, ${c.display_name}, ${c.source || 'openalex'}, ${c.level ?? null}, ${c.score ?? null})
      ON CONFLICT (doi_record_id, concept_id) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        source = EXCLUDED.source,
        level = EXCLUDED.level,
        score = EXCLUDED.score`;
  }
}

async function deleteConceptsForRecord(recordId, source) {
  if (source) {
    await sql`DELETE FROM doi_concepts WHERE doi_record_id = ${recordId} AND source = ${source}`;
  } else {
    await sql`DELETE FROM doi_concepts WHERE doi_record_id = ${recordId}`;
  }
}

module.exports = { upsertCitationsByYear, upsertConcepts, deleteConceptsForRecord };

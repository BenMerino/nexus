const { sql } = require("./sql");
const { resolvePubFilter } = require("./stats-scope");

// Tenant-wide research areas from the OpenAlex concepts already stored per
// record (doi_concepts) — the institutional counterpart of the personal
// portfolio's getTopConcepts (portfolio-aggregates.js). Counts DISTINCT
// publications per concept name so a multi-concept paper can't double-count
// within one area; openalex-sourced only (keyword-extracted concepts are
// noisier and weight differently). Honors org-unit scope via resolvePubFilter.
async function getResearchAreas(scope, limit = 12) {
  const f = await resolvePubFilter(scope);
  const r = await sql.query(
    `SELECT c.display_name AS name, COUNT(DISTINCT p.id)::int AS count
     FROM doi_concepts c
     JOIN publications p ON p.id = c.doi_record_id
     WHERE c.source = 'openalex' AND ${f.where}
     GROUP BY c.display_name
     ORDER BY count DESC
     LIMIT ${limit}`, f.params);
  return r.rows.map((row) => ({ name: row.name, count: row.count }));
}

module.exports = { getResearchAreas };

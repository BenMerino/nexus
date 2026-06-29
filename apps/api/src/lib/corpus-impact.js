const { sql } = require("./sql");
const { calculateHIndex } = require("./h-index");

// Institutional h-index: the in-scope corpus's own h over its per-publication
// citation counts (the largest h such that h papers each have ≥ h citations).
// Distinct from the per-author h-index (h-index.js getAuthorHIndexes) — this is
// the aggregate for the whole set behind the overview card. Takes the resolved
// pub filter ({ where, params } over publications p), pulls only the citation
// column (cheap, one indexed-filter scan), and folds via the shared
// calculateHIndex. i10-index is a plain COUNT and stays inline in getSummary.
async function corpusHIndex(f) {
  const r = await sql.query(
    `SELECT citation_count FROM publications p
     WHERE ${f.where} AND citation_count > 0`, f.params);
  return calculateHIndex(r.rows.map((row) => parseInt(row.citation_count) || 0));
}

module.exports = { corpusHIndex };

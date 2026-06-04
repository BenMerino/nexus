const { sql } = require("./sql");
const { resolvePubFilter } = require("./stats-scope");

// Per-year series for the public KPI cards' sparklines — the METHODOLOGIC
// interpretation behind each headline figure (a real trend, not a glyph). All
// three narrow with scope via resolvePubFilter (a unitKey → one faculty's
// authors), so the sparklines re-scope exactly like the KPI numbers above them.
// Returns { publications:[{year,value}], citations:[…], authors:[…] }, each
// ascending by year over the metric's natural window.

// Publications per published-year (full span). Alias `p` for the filter.
async function pubsByYear(scope) {
  const f = await resolvePubFilter(scope);
  const r = await sql.query(
    `SELECT SUBSTRING(p.published FROM 1 FOR 4) AS year, COUNT(*)::int AS value
     FROM publications p
     WHERE ${f.where} AND p.published ~ '^[0-9]{4}'
     GROUP BY 1 ORDER BY 1`, f.params);
  return r.rows.map((row) => ({ year: Number(row.year), value: row.value }));
}

// Citations received per year (the same table velocity reads), full span.
async function citesByYear(scope) {
  const f = await resolvePubFilter(scope);
  const r = await sql.query(
    `SELECT c.year, SUM(c.count)::int AS value
     FROM doi_citations_by_year c
     JOIN publications p ON p.id = c.doi_record_id
     WHERE ${f.where}
     GROUP BY c.year ORDER BY c.year`, f.params);
  return r.rows.map((row) => ({ year: Number(row.year), value: row.value }));
}

// Distinct authors with at least one paper published each year — the
// "researchers active per year" trend behind the Authors KPI.
async function authorsByYear(scope) {
  const f = await resolvePubFilter(scope);
  const r = await sql.query(
    `SELECT SUBSTRING(p.published FROM 1 FOR 4) AS year,
            COUNT(DISTINCT s.author_id)::int AS value
     FROM publications p
     JOIN authorship s ON s.publication_id = p.id
     WHERE ${f.where} AND p.published ~ '^[0-9]{4}'
     GROUP BY 1 ORDER BY 1`, f.params);
  return r.rows.map((row) => ({ year: Number(row.year), value: row.value }));
}

async function buildKpiSparks(scope) {
  const [publications, citations, authors] = await Promise.all([
    pubsByYear(scope), citesByYear(scope), authorsByYear(scope),
  ]);
  return { publications, citations, authors };
}

module.exports = { buildKpiSparks };

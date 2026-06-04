const { sql } = require("./sql");
const { computeVelocity, buildVelocitySeries } = require("./portfolio-velocity");
const { buildCadence } = require("./portfolio-aggregates");
const { resolvePubFilter } = require("./stats-scope");

// Tenant-scoped citation velocity. Same shape and same buildVelocitySeries
// helper the researcher dashboard uses for a single ORCID — just summing
// citation counts across every DOI at the tenant instead of one author's
// papers. Scope-narrowed via resolvePubFilter (alias `p`): a unitKey narrows to
// that faculty/department's authors. 5-year window, 3-year forecast.
async function buildTenantVelocity(scope) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const span = 5;
  const f = await resolvePubFilter(scope); // over `publications p` (= doi_records)
  const yearIdx = f.params.length + 1;
  const r = await sql.query(
    `SELECT c.year, SUM(c.count)::int AS total
     FROM doi_citations_by_year c
     JOIN publications p ON p.id = c.doi_record_id
     WHERE ${f.where}
       AND c.year >= $${yearIdx}
     GROUP BY c.year`,
    [...f.params, currentYear - span + 1]);
  const byYear = new Map(r.rows.map(row => [row.year, row.total]));
  const score = computeVelocity(byYear, currentYear);
  const { series, forecast, trend } = buildVelocitySeries(byYear, currentYear, now);
  return { series, forecast, score: Math.round(score * 100) / 100, trend };
}

// Tenant-scoped publication cadence. Reuses buildCadence() — same 8-year
// stacked-by-type bars + mean-per-year line — but feeds it every DOI at the
// tenant (or one faculty/department when scope carries a unitKey) rather than
// one researcher's works.
async function buildTenantCadence(scope) {
  const f = await resolvePubFilter(scope); // over `publications p`
  const r = await sql.query(
    `SELECT p.published AS year, p.type
     FROM publications p
     WHERE ${f.where} AND p.published IS NOT NULL AND p.published <> ''`,
    f.params);
  const works = r.rows.map(row => ({ year: row.year, type: row.type || "unknown" }));
  return buildCadence(works);
}

module.exports = { buildTenantVelocity, buildTenantCadence };

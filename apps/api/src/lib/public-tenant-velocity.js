const { sql } = require("./sql");
const { computeVelocity, buildVelocitySeries } = require("./portfolio-velocity");
const { buildCadence } = require("./portfolio-aggregates");

// Tenant-scoped citation velocity. Same shape and same buildVelocitySeries
// helper the researcher dashboard uses for a single ORCID — just summing
// citation counts across every DOI at the tenant instead of one author's
// papers. 5-year window, 3-year forecast.
async function buildTenantVelocity(tenantId) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const span = 5;
  const r = await sql`
    SELECT c.year, SUM(c.count)::int AS total
    FROM doi_citations_by_year c
    JOIN doi_records d ON d.id = c.doi_record_id
    WHERE d.tenant_id = ${tenantId}
      AND c.year >= ${currentYear - span + 1}
    GROUP BY c.year`;
  const byYear = new Map(r.rows.map(row => [row.year, row.total]));
  const score = computeVelocity(byYear, currentYear);
  const { series, forecast, trend } = buildVelocitySeries(byYear, currentYear, now);
  return { series, forecast, score: Math.round(score * 100) / 100, trend };
}

// Tenant-scoped publication cadence. Reuses buildCadence() — same 8-year
// stacked-by-type bars + mean-per-year line — but feeds it every DOI at
// the tenant rather than one researcher's works.
async function buildTenantCadence(tenantId) {
  const r = await sql`
    SELECT published AS year, type
    FROM doi_records
    WHERE tenant_id = ${tenantId} AND published IS NOT NULL AND published <> ''`;
  const works = r.rows.map(row => ({ year: row.year, type: row.type || "unknown" }));
  return buildCadence(works);
}

module.exports = { buildTenantVelocity, buildTenantCadence };

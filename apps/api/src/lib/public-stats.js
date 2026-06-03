const { sql } = require("./sql");
const { getSummary, getByYearAndSource, getCollaborations, getCountries } = require("./dashboard-stats");
const { buildTenantVelocity, buildTenantCadence } = require("./public-tenant-velocity");

async function getPublicationTypes(tenantId) {
  const r = await sql`
    SELECT COALESCE(NULLIF(type, ''), 'other') as type, COUNT(*) as count
    FROM doi_records WHERE tenant_id = ${tenantId}
    GROUP BY COALESCE(NULLIF(type, ''), 'other') ORDER BY count DESC`;
  return r.rows.map(row => ({ type: row.type, count: parseInt(row.count) }));
}

// Top journals by paper count. Reads the entity model (venues + published_in):
// a venue is one journal (ISSN siblings already collapsed), venue_type='journal'
// excludes repositories (SSRN) and book series (non-journal) — matching the old
// category='journal' tag filter. Counts distinct publications per venue.
async function getTopJournals(tenantId, limit = 10) {
  const r = await sql`
    SELECT v.name as journal, COUNT(DISTINCT pi.publication_id) as count
    FROM venues v
    JOIN published_in pi ON pi.venue_id = v.id
    JOIN publications d ON d.id = pi.publication_id
    WHERE v.tenant_id = ${tenantId} AND v.venue_type = 'journal' AND d.tenant_id = ${tenantId}
    GROUP BY v.id, v.name
    ORDER BY count DESC LIMIT ${limit}`;
  return r.rows.map(row => ({ journal: row.journal, count: parseInt(row.count) }));
}

async function getTypeByYear(tenantId) {
  const r = await sql`
    SELECT COALESCE(NULLIF(type, ''), 'other') AS type,
           SUBSTRING(published FROM 1 FOR 4) AS year,
           COUNT(*) AS count
    FROM doi_records
    WHERE tenant_id = ${tenantId} AND published IS NOT NULL AND published <> ''
    GROUP BY COALESCE(NULLIF(type, ''), 'other'), SUBSTRING(published FROM 1 FOR 4)`;
  return r.rows.map(row => ({ type: row.type, year: row.year, count: parseInt(row.count) }));
}

// Presence flag: does this tenant have ANY indexed-venue publication? The
// charts tab gates the stacked "Publicaciones por año" chart on this
// (hasYearIndex); the chart's actual data is composed on demand via the
// publications.byIndex recompose kind, never shipped here. So we only need a
// boolean — a SELECT EXISTS (~1ms), not a 93k-row per-(paper,year) reduce in
// JS (~170ms + the GC of all those rows). Returned as a 0-or-1-length array of
// {bucket} so the existing hasYearIndex() reader is unchanged.
async function getYearByIndexation(tenantId) {
  const r = await sql`
    SELECT EXISTS (
      SELECT 1 FROM published_in pi
      JOIN venues v ON v.id = pi.venue_id AND v.tenant_id = ${tenantId}
      JOIN doi_records d ON d.id = pi.publication_id AND d.tenant_id = ${tenantId}
      WHERE (v.in_wos OR v.in_scopus OR v.in_doaj OR v.in_scielo)
    ) AS has_index`;
  return r.rows[0] && r.rows[0].has_index ? [{ bucket: "WoS" }] : [];
}

async function getYearRange(tenantId) {
  const r = await sql`
    SELECT MIN(SUBSTRING(published FROM 1 FOR 4)) as min_year,
           MAX(SUBSTRING(published FROM 1 FOR 4)) as max_year
    FROM doi_records
    WHERE tenant_id = ${tenantId} AND published IS NOT NULL AND published <> ''`;
  const row = r.rows[0] || {};
  return { minYear: row.min_year || null, maxYear: row.max_year || null };
}

// CHROME — the cheap fields the page shell needs to paint immediately: the
// summary cards (overview tab) + the header's year range. Both are sub-10ms
// aggregates. The shell renders from these alone; it never blocks on the heavy
// analytics, which the charts tab fetches separately (getPublicAnalytics).
async function getPublicChrome(scope) {
  const [summary, yearRange] = await Promise.all([
    getSummary(scope),
    getYearRange(scope.tenantId),
  ]);
  return { summary, yearRange };
}

// ANALYTICS — the heavy chart aggregates, fetched lazily when the charts tab
// opens (not on the shell's critical path). yearByIndex is now a cheap presence
// flag (EXISTS); the byIndex chart's data is composed on demand via the
// publications.byIndex recompose kind, not shipped here.
async function getPublicAnalytics(scope) {
  const [yearSource, collabs, countries, types, journals, typeByYear, yearByIndex, velocity, cadence] = await Promise.all([
    getByYearAndSource(scope),
    getCollaborations(scope),
    getCountries(scope),
    getPublicationTypes(scope.tenantId),
    getTopJournals(scope.tenantId),
    getTypeByYear(scope.tenantId),
    getYearByIndexation(scope.tenantId),
    buildTenantVelocity(scope.tenantId),
    buildTenantCadence(scope.tenantId),
  ]);
  return { yearSource, collabs, countries, types, journals, typeByYear, yearByIndex, velocity, cadence };
}

// Full payload — chrome + analytics. Kept for any caller wanting everything in
// one shot; the public page now fetches chrome and analytics separately so the
// shell is never gated on analytics.
async function getPublicStats(scope) {
  const [chrome, analytics] = await Promise.all([getPublicChrome(scope), getPublicAnalytics(scope)]);
  return { ...chrome, ...analytics };
}

module.exports = {
  getPublicationTypes, getTopJournals, getYearRange,
  getTypeByYear, getYearByIndexation,
  getPublicChrome, getPublicAnalytics, getPublicStats,
};

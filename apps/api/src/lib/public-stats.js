const { sql } = require("./sql");
const { getSummary, getByYearAndSource, getCollaborations, getCountries } = require("./dashboard-stats");
const { listSourceIds } = require("./indexation-sources");
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

async function getYearByIndexation(tenantId) {
  const INDEXES = listSourceIds();
  // Entity model: a paper is "indexed in X" when its venue carries the in_X flag
  // (published_in → venues). One row per (paper, year) with the venue's index
  // sources; counted per (year, index). Replaces the legacy indexed_in tag join.
  const r = await sql`
    SELECT d.id, SUBSTRING(d.published FROM 1 FOR 4) AS year,
           bool_or(v.in_wos) AS wos, bool_or(v.in_scopus) AS scopus,
           bool_or(v.in_doaj) AS doaj, bool_or(v.in_scielo) AS scielo
    FROM doi_records d
    LEFT JOIN published_in pi ON pi.publication_id = d.id
    LEFT JOIN venues v ON v.id = pi.venue_id AND v.tenant_id = ${tenantId}
    WHERE d.tenant_id = ${tenantId} AND d.published IS NOT NULL AND d.published <> ''
    GROUP BY d.id, SUBSTRING(d.published FROM 1 FOR 4)`;
  const flagFor = { WoS: "wos", Scopus: "scopus", DOAJ: "doaj", SciELO: "scielo" };
  const counts = new Map();
  for (const row of r.rows) {
    if (!row.year) continue;
    for (const idx of INDEXES) {
      const col = flagFor[idx];
      if (!col || !row[col]) continue;
      const key = `${row.year}|${idx}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return [...counts.entries()].map(([k, count]) => {
    const [year, bucket] = k.split("|");
    return { year, bucket, count };
  });
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

async function getPublicStats(scope) {
  const [summary, yearSource, collabs, countries, types, journals, yearRange, typeByYear, yearByIndex, velocity, cadence] = await Promise.all([
    getSummary(scope),
    getByYearAndSource(scope),
    getCollaborations(scope),
    getCountries(scope),
    getPublicationTypes(scope.tenantId),
    getTopJournals(scope.tenantId),
    getYearRange(scope.tenantId),
    getTypeByYear(scope.tenantId),
    getYearByIndexation(scope.tenantId),
    buildTenantVelocity(scope.tenantId),
    buildTenantCadence(scope.tenantId),
  ]);
  return { summary, yearSource, collabs, countries, types, journals, yearRange, typeByYear, yearByIndex, velocity, cadence };
}

module.exports = {
  getPublicationTypes, getTopJournals, getYearRange,
  getTypeByYear, getYearByIndexation, getPublicStats,
};

const { sql } = require("@vercel/postgres");
const { getSummary, getByYearAndSource, getCollaborations, getCountries } = require("./dashboard-stats");
const { listSourceIds } = require("./indexation-sources");

async function getPublicationTypes(tenantId) {
  const r = await sql`
    SELECT COALESCE(NULLIF(type, ''), 'other') as type, COUNT(*) as count
    FROM doi_records WHERE tenant_id = ${tenantId}
    GROUP BY COALESCE(NULLIF(type, ''), 'other') ORDER BY count DESC`;
  return r.rows.map(row => ({ type: row.type, count: parseInt(row.count) }));
}

async function getTopJournals(tenantId, limit = 10) {
  const r = await sql`
    SELECT t.value as journal, COUNT(DISTINCT t.doi_record_id) as count
    FROM tags t JOIN doi_records d ON d.id = t.doi_record_id
    WHERE t.category = 'journal' AND d.tenant_id = ${tenantId}
    GROUP BY t.value
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
  const r = await sql`
    SELECT d.id, SUBSTRING(d.published FROM 1 FOR 4) AS year,
           array_remove(array_agg(DISTINCT t.value), NULL) AS indices
    FROM doi_records d
    LEFT JOIN tags t ON t.doi_record_id = d.id
      AND t.category = 'indexed_in'
      AND t.value = ANY(${INDEXES})
    WHERE d.tenant_id = ${tenantId} AND d.published IS NOT NULL AND d.published <> ''
    GROUP BY d.id, SUBSTRING(d.published FROM 1 FOR 4)`;
  const counts = new Map();
  for (const row of r.rows) {
    if (!row.year) continue;
    for (const idx of INDEXES) {
      if (!(row.indices || []).includes(idx)) continue;
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
  const [summary, yearSource, collabs, countries, types, journals, yearRange, typeByYear, yearByIndex] = await Promise.all([
    getSummary(scope),
    getByYearAndSource(scope),
    getCollaborations(scope),
    getCountries(scope),
    getPublicationTypes(scope.tenantId),
    getTopJournals(scope.tenantId),
    getYearRange(scope.tenantId),
    getTypeByYear(scope.tenantId),
    getYearByIndexation(scope.tenantId),
  ]);
  return { summary, yearSource, collabs, countries, types, journals, yearRange, typeByYear, yearByIndex };
}

module.exports = {
  getPublicationTypes, getTopJournals, getYearRange,
  getTypeByYear, getYearByIndexation, getPublicStats,
};

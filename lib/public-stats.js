const { sql } = require("@vercel/postgres");
const { getSummary, getByYearAndSource, getCollaborations, getCountries } = require("./dashboard-stats");

async function getPublicationTypes(tenantId) {
  const r = await sql`
    SELECT COALESCE(NULLIF(type, ''), 'other') as type, COUNT(*) as count
    FROM doi_records WHERE tenant_id = ${tenantId}
    GROUP BY COALESCE(NULLIF(type, ''), 'other') ORDER BY count DESC`;
  return r.rows.map(row => ({ type: row.type, count: parseInt(row.count) }));
}

async function getTopJournals(tenantId, limit = 10) {
  const r = await sql`
    SELECT MAX(t.value) as journal, COUNT(*) as count
    FROM tags t JOIN doi_records d ON d.id = t.doi_record_id
    WHERE t.category = 'journal' AND d.tenant_id = ${tenantId}
    GROUP BY COALESCE(t.ext_id, t.value)
    ORDER BY count DESC LIMIT ${limit}`;
  return r.rows.map(row => ({ journal: row.journal, count: parseInt(row.count) }));
}

async function getBySource(tenantId) {
  const r = await sql`
    SELECT COALESCE(NULLIF(t.value, ''), 'Unknown') AS source, COUNT(DISTINCT d.id) AS count
    FROM doi_records d
    LEFT JOIN tags t ON t.doi_record_id = d.id AND t.category = 'source'
    WHERE d.tenant_id = ${tenantId}
    GROUP BY COALESCE(NULLIF(t.value, ''), 'Unknown')
    ORDER BY count DESC`;
  return r.rows.map(row => ({ source: row.source, count: parseInt(row.count) }));
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
  const [summary, yearSource, collabs, countries, types, journals, yearRange, bySource, typeByYear] = await Promise.all([
    getSummary(scope),
    getByYearAndSource(scope),
    getCollaborations(scope),
    getCountries(scope),
    getPublicationTypes(scope.tenantId),
    getTopJournals(scope.tenantId),
    getYearRange(scope.tenantId),
    getBySource(scope.tenantId),
    getTypeByYear(scope.tenantId),
  ]);
  return { summary, yearSource, collabs, countries, types, journals, yearRange, bySource, typeByYear };
}

module.exports = { getPublicationTypes, getTopJournals, getYearRange, getBySource, getTypeByYear, getPublicStats };

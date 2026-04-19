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
  const [summary, yearSource, collabs, countries, types, journals, yearRange] = await Promise.all([
    getSummary(scope),
    getByYearAndSource(scope),
    getCollaborations(scope),
    getCountries(scope),
    getPublicationTypes(scope.tenantId),
    getTopJournals(scope.tenantId),
    getYearRange(scope.tenantId),
  ]);
  return { summary, yearSource, collabs, countries, types, journals, yearRange };
}

module.exports = { getPublicationTypes, getTopJournals, getYearRange, getPublicStats };

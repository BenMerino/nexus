const { sql } = require("@vercel/postgres");
const { isPersonalScope } = require("./scope");

async function getSummary(scope) {
  if (!scope) throw new Error("getSummary requires scope");
  const filter = isPersonalScope(scope);
  const r = filter ? await sql`
    SELECT COUNT(*) as total_pubs,
           COALESCE(SUM(citation_count), 0) as total_citations,
           COUNT(DISTINCT CASE WHEN open_access THEN doi END) as oa_count
    FROM doi_records WHERE id IN (
      SELECT doi_record_id FROM tags WHERE category='author' AND ext_id=${scope.orcid}
    )`
  : await sql`
    SELECT COUNT(*) as total_pubs,
           COALESCE(SUM(citation_count), 0) as total_citations,
           COUNT(DISTINCT CASE WHEN open_access THEN doi END) as oa_count
    FROM doi_records WHERE tenant_id = ${scope.tenantId}`;
  const authors = filter ? await sql`
    SELECT COUNT(DISTINCT COALESCE(ext_id, value)) as count FROM tags
    WHERE category = 'author' AND doi_record_id IN (
      SELECT doi_record_id FROM tags WHERE category='author' AND ext_id=${scope.orcid}
    )`
  : await sql`
    SELECT COUNT(DISTINCT COALESCE(t.ext_id, t.value)) as count
    FROM tags t JOIN doi_records d ON d.id = t.doi_record_id
    WHERE t.category = 'author' AND d.tenant_id = ${scope.tenantId}`;
  const row = r.rows[0];
  return {
    totalPubs: parseInt(row.total_pubs),
    totalCitations: parseInt(row.total_citations),
    oaCount: parseInt(row.oa_count),
    authorCount: parseInt(authors.rows[0].count),
  };
}

async function getByYearAndSource(scope) {
  if (!scope) throw new Error("getByYearAndSource requires scope");
  const r = isPersonalScope(scope) ? await sql`
    SELECT SUBSTRING(d.published FROM 1 FOR 4) as year,
      COALESCE(s.value, 'Other') as source, COUNT(*) as count
    FROM doi_records d
    LEFT JOIN tags s ON s.doi_record_id = d.id AND s.category = 'source'
    WHERE d.published IS NOT NULL AND d.id IN (
      SELECT doi_record_id FROM tags WHERE category='author' AND ext_id=${scope.orcid}
    )
    GROUP BY SUBSTRING(d.published FROM 1 FOR 4), s.value ORDER BY year`
  : await sql`
    SELECT SUBSTRING(d.published FROM 1 FOR 4) as year,
      COALESCE(s.value, 'Other') as source, COUNT(*) as count
    FROM doi_records d
    LEFT JOIN tags s ON s.doi_record_id = d.id AND s.category = 'source'
    WHERE d.published IS NOT NULL AND d.tenant_id = ${scope.tenantId}
    GROUP BY SUBSTRING(d.published FROM 1 FOR 4), s.value ORDER BY year`;
  return r.rows;
}

async function getCollaborations(scope) {
  if (!scope) throw new Error("getCollaborations requires scope");
  const r = isPersonalScope(scope) ? await sql`
    SELECT MAX(t.value) as value, COALESCE(t.ext_id, t.value) as group_key, COUNT(*) as count
    FROM tags t JOIN doi_records d ON d.id = t.doi_record_id
    WHERE t.category = 'institution' AND d.id IN (
      SELECT doi_record_id FROM tags WHERE category='author' AND ext_id=${scope.orcid}
    )
    GROUP BY COALESCE(t.ext_id, t.value) ORDER BY count DESC LIMIT 20`
  : await sql`
    SELECT MAX(t.value) as value, COALESCE(t.ext_id, t.value) as group_key, COUNT(*) as count
    FROM tags t JOIN doi_records d ON d.id = t.doi_record_id
    WHERE t.category = 'institution' AND d.tenant_id = ${scope.tenantId}
    GROUP BY COALESCE(t.ext_id, t.value) ORDER BY count DESC LIMIT 20`;
  return r.rows;
}

async function getCountries(scope) {
  if (!scope) throw new Error("getCountries requires scope");
  const r = isPersonalScope(scope) ? await sql`
    SELECT affiliations FROM doi_records
    WHERE affiliations IS NOT NULL AND id IN (
      SELECT doi_record_id FROM tags WHERE category='author' AND ext_id=${scope.orcid}
    )`
  : await sql`
    SELECT affiliations FROM doi_records
    WHERE affiliations IS NOT NULL AND tenant_id = ${scope.tenantId}`;
  const countryCounts = {};
  for (const row of r.rows) {
    try {
      const affs = JSON.parse(row.affiliations);
      for (const author of affs) {
        for (const aff of author.affiliations || []) {
          const country = aff.country;
          if (country) countryCounts[country] = (countryCounts[country] || 0) + 1;
        }
      }
    } catch {}
  }
  return Object.entries(countryCounts)
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
}

async function getTopJournals(scope) {
  if (!scope) throw new Error("getTopJournals requires scope");
  const r = isPersonalScope(scope) ? await sql`
    SELECT MAX(t.value) as value, COALESCE(t.ext_id, t.value) as key, COUNT(*) as count
    FROM tags t JOIN doi_records d ON d.id = t.doi_record_id
    WHERE t.category = 'journal' AND d.id IN (
      SELECT doi_record_id FROM tags WHERE category='author' AND ext_id=${scope.orcid}
    )
    GROUP BY COALESCE(t.ext_id, t.value) ORDER BY count DESC LIMIT 10`
  : await sql`
    SELECT MAX(t.value) as value, COALESCE(t.ext_id, t.value) as key, COUNT(*) as count
    FROM tags t JOIN doi_records d ON d.id = t.doi_record_id
    WHERE t.category = 'journal' AND d.tenant_id = ${scope.tenantId}
    GROUP BY COALESCE(t.ext_id, t.value) ORDER BY count DESC LIMIT 10`;
  return r.rows;
}

async function getRecentPapers(scope) {
  if (!scope) throw new Error("getRecentPapers requires scope");
  const r = isPersonalScope(scope) ? await sql`
    SELECT d.doi, d.title, d.published, d.citation_count, d.type,
      (SELECT MAX(value) FROM tags WHERE doi_record_id = d.id AND category = 'journal') as journal
    FROM doi_records d
    WHERE d.id IN (SELECT doi_record_id FROM tags WHERE category='author' AND ext_id=${scope.orcid})
    ORDER BY d.published DESC NULLS LAST LIMIT 8`
  : await sql`
    SELECT d.doi, d.title, d.published, d.citation_count, d.type,
      (SELECT MAX(value) FROM tags WHERE doi_record_id = d.id AND category = 'journal') as journal
    FROM doi_records d
    WHERE d.tenant_id = ${scope.tenantId}
    ORDER BY d.published DESC NULLS LAST LIMIT 8`;
  return r.rows;
}

module.exports = { getSummary, getByYearAndSource, getCollaborations, getCountries, getTopJournals, getRecentPapers };

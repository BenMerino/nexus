const { sql } = require("./sql");
const { isPersonalScope } = require("./scope");
const { scopedPubFilter } = require("./stats-scope");

// Dashboard stats — entity-backed (tags → entities migration). Personal scope
// narrows to the user's own publications via authorship; admin scope is the
// whole tenant. See stats-scope.scopedPubFilter for the shared narrowing.

async function getSummary(scope) {
  if (!scope) throw new Error("getSummary requires scope");
  const f = scopedPubFilter(scope); // { where, params } over publications p
  const r = await sql.query(
    `SELECT COUNT(*) total_pubs, COALESCE(SUM(citation_count),0) total_citations,
            COUNT(DISTINCT CASE WHEN open_access THEN doi END) oa_count
     FROM publications p WHERE ${f.where}`, f.params);
  // Distinct authors on those publications.
  const a = await sql.query(
    `SELECT COUNT(DISTINCT s.author_id) count
     FROM authorship s JOIN publications p ON p.id = s.publication_id WHERE ${f.where}`, f.params);
  const row = r.rows[0];
  return {
    totalPubs: parseInt(row.total_pubs),
    totalCitations: parseInt(row.total_citations),
    oaCount: parseInt(row.oa_count),
    authorCount: parseInt(a.rows[0].count),
  };
}

// Publications per year. The legacy `source` tag (vestigial provenance, no
// entity/domain) is dropped; the series keeps a constant `source` so the chart
// shape is unchanged. Provenance-by-year, if ever wanted, is a Publication
// property (publications.source_indices), not a tag.
async function getByYearAndSource(scope) {
  if (!scope) throw new Error("getByYearAndSource requires scope");
  const f = scopedPubFilter(scope);
  const r = await sql.query(
    `SELECT SUBSTRING(p.published FROM 1 FOR 4) AS year, 'All' AS source, COUNT(*) AS count
     FROM publications p WHERE p.published IS NOT NULL AND ${f.where}
     GROUP BY SUBSTRING(p.published FROM 1 FOR 4) ORDER BY year`, f.params);
  return r.rows;
}

// Top collaborating institutions — direct pub↔institution edges (affiliated_with,
// the superset the graph/collab counts use). group_key = institution id.
async function getCollaborations(scope) {
  if (!scope) throw new Error("getCollaborations requires scope");
  const f = scopedPubFilter(scope);
  const r = await sql.query(
    `SELECT i.name value, i.id::text group_key, COUNT(DISTINCT p.id) count
     FROM affiliated_with aw JOIN institutions i ON i.id = aw.institution_id
     JOIN publications p ON p.id = aw.publication_id
     WHERE i.tenant_id = $${f.params.length + 1} AND ${f.where}
     GROUP BY i.id, i.name ORDER BY count DESC LIMIT 20`, [...f.params, scope.tenantId]);
  return r.rows;
}

async function getCountries(scope) {
  if (!scope) throw new Error("getCountries requires scope");
  const f = scopedPubFilter(scope);
  const r = await sql.query(
    `SELECT affiliations FROM publications p WHERE affiliations IS NOT NULL AND ${f.where}`, f.params);
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

// Top journals — venues + published_in, journals only (ISSN siblings already
// collapsed into one venue by name_key). key = venue id.
async function getTopJournals(scope) {
  if (!scope) throw new Error("getTopJournals requires scope");
  const f = scopedPubFilter(scope);
  const r = await sql.query(
    `SELECT v.name value, v.id::text key, COUNT(DISTINCT p.id) count
     FROM venues v JOIN published_in pi ON pi.venue_id = v.id
     JOIN publications p ON p.id = pi.publication_id
     WHERE v.tenant_id = $${f.params.length + 1} AND v.venue_type = 'journal' AND ${f.where}
     GROUP BY v.id, v.name ORDER BY count DESC LIMIT 10`, [...f.params, scope.tenantId]);
  return r.rows;
}

async function getRecentPapers(scope) {
  if (!scope) throw new Error("getRecentPapers requires scope");
  const f = scopedPubFilter(scope);
  const r = await sql.query(
    `SELECT p.doi, p.title, p.published, p.citation_count, p.type,
       (SELECT v.name FROM published_in pi JOIN venues v ON v.id = pi.venue_id
        WHERE pi.publication_id = p.id AND v.venue_type = 'journal' LIMIT 1) journal
     FROM publications p WHERE ${f.where}
     ORDER BY p.published DESC NULLS LAST LIMIT 8`, f.params);
  return r.rows;
}

module.exports = { getSummary, getByYearAndSource, getCollaborations, getCountries, getTopJournals, getRecentPapers };

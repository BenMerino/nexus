const { sql } = require("./sql");
const { isPersonalScope } = require("./scope");
const { resolvePubFilter } = require("./stats-scope");
const { getAuthorCount } = require("./public-authors");
// Categorical top-N readers (institutions/countries/journals) live in their own
// file (N5); re-exported below so callers keep importing from dashboard-stats.
const { getCollaborations, getCountries, getTopJournals } = require("./dashboard-stats-categorical");

// Dashboard stats — entity-backed (tags → entities migration). Personal scope
// narrows to the user's own publications via authorship; admin scope is the
// whole tenant. See stats-scope.scopedPubFilter for the shared narrowing.

async function getSummary(scope) {
  if (!scope) throw new Error("getSummary requires scope");
  const f = await resolvePubFilter(scope); // { where, params } over publications p
  const r = await sql.query(
    `SELECT COUNT(*) total_pubs, COALESCE(SUM(citation_count),0) total_citations,
            COUNT(DISTINCT CASE WHEN open_access THEN doi END) oa_count,
            COUNT(*) FILTER (WHERE citation_count > 0) cited_count
     FROM publications p WHERE ${f.where}`, f.params);
  const row = r.rows[0];
  return {
    totalPubs: parseInt(row.total_pubs),
    totalCitations: parseInt(row.total_citations),
    oaCount: parseInt(row.oa_count),
    citedCount: parseInt(row.cited_count),
    authorCount: await authorCountFor(scope),
  };
}

// "Authors" means different populations by scope, and the overview card MUST
// agree with the /authors tab:
//   • admin/public → the tenant's RESEARCHERS — authors affiliated with the
//     tenant's own institution (ROR), the same ROR-filtered aggregate the
//     /authors tab shows (getAuthorCount, cached). Counting raw `authorship`
//     here instead inflated this to every external co-author in the corpus
//     (126k for UTalca vs the real faculty count).
//   • personal → the user's OWN collaborators: distinct authors on the user's
//     own papers (scopedPubFilter already narrows to those), NOT the tenant total.
async function authorCountFor(scope) {
  // Tenant/public (no unit) → the cached ROR-filtered researcher count.
  if (!isPersonalScope(scope) && !(scope && scope.unitKey)) return getAuthorCount(scope.tenantId, scope.ror);
  // Personal OR unit-scoped → distinct authors on the in-scope papers. For a
  // unit this is the unit's collaborating authors on its output (consistent
  // with how the personal card counts a researcher's own collaborators).
  const f = await resolvePubFilter(scope);
  const a = await sql.query(
    `SELECT COUNT(DISTINCT s.author_id) count
     FROM authorship s JOIN publications p ON p.id = s.publication_id WHERE ${f.where}`, f.params);
  return parseInt(a.rows[0].count);
}

// Publications per year. The legacy `source` tag (vestigial provenance, no
// entity/domain) is dropped; the series keeps a constant `source` so the chart
// shape is unchanged. Provenance-by-year, if ever wanted, is a Publication
// property (publications.source_indices), not a tag.
async function getByYearAndSource(scope) {
  if (!scope) throw new Error("getByYearAndSource requires scope");
  const f = await resolvePubFilter(scope);
  const r = await sql.query(
    `SELECT SUBSTRING(p.published FROM 1 FOR 4) AS year, 'All' AS source, COUNT(*) AS count
     FROM publications p WHERE p.published IS NOT NULL AND ${f.where}
     GROUP BY SUBSTRING(p.published FROM 1 FOR 4) ORDER BY year`, f.params);
  return r.rows;
}

async function getRecentPapers(scope) {
  if (!scope) throw new Error("getRecentPapers requires scope");
  const f = await resolvePubFilter(scope);
  const r = await sql.query(
    `SELECT p.doi, p.title, p.published, p.citation_count, p.type,
       (SELECT v.name FROM published_in pi JOIN venues v ON v.id = pi.venue_id
        WHERE pi.publication_id = p.id AND v.venue_type = 'journal' LIMIT 1) journal
     FROM publications p WHERE ${f.where}
     ORDER BY p.published DESC NULLS LAST LIMIT 8`, f.params);
  return r.rows;
}

module.exports = { getSummary, getByYearAndSource, getCollaborations, getCountries, getTopJournals, getRecentPapers };

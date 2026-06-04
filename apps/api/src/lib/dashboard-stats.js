const { sql } = require("./sql");
const { isPersonalScope } = require("./scope");
const { resolvePubFilter } = require("./stats-scope");
const { getAuthorCount } = require("./public-authors");
const { normRor } = require("./entity-normalize");

// Dashboard stats — entity-backed (tags → entities migration). Personal scope
// narrows to the user's own publications via authorship; admin scope is the
// whole tenant. See stats-scope.scopedPubFilter for the shared narrowing.

async function getSummary(scope) {
  if (!scope) throw new Error("getSummary requires scope");
  const f = await resolvePubFilter(scope); // { where, params } over publications p
  const r = await sql.query(
    `SELECT COUNT(*) total_pubs, COALESCE(SUM(citation_count),0) total_citations,
            COUNT(DISTINCT CASE WHEN open_access THEN doi END) oa_count
     FROM publications p WHERE ${f.where}`, f.params);
  const row = r.rows[0];
  return {
    totalPubs: parseInt(row.total_pubs),
    totalCitations: parseInt(row.total_citations),
    oaCount: parseInt(row.oa_count),
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

// Top collaborating institutions — direct pub↔institution edges (affiliated_with,
// the superset the graph/collab counts use). group_key = institution id.
//
// Excludes the tenant's OWN institution: a tenant is not its own collaborator,
// and since it's on ~every one of its papers it would otherwise rank #1 and
// dominate the chart. scope.ror is the home ROR (normalized to bare-id to match
// how institutions.ror is stored at ingest). When scope.ror is absent the
// filter is a no-op — callers that want the exclusion must pass it.
async function getCollaborations(scope) {
  if (!scope) throw new Error("getCollaborations requires scope");
  const f = await resolvePubFilter(scope);
  const homeRor = normRor(scope.ror);
  const params = [...f.params, scope.tenantId];
  let homeFilter = "";
  if (homeRor) {
    params.push(homeRor);
    homeFilter = ` AND i.ror IS DISTINCT FROM $${params.length}`;
  }
  const r = await sql.query(
    `SELECT i.name value, i.id::text group_key, COUNT(DISTINCT p.id) count
     FROM affiliated_with aw JOIN institutions i ON i.id = aw.institution_id
     JOIN publications p ON p.id = aw.publication_id
     WHERE i.tenant_id = $${f.params.length + 1} AND ${f.where}${homeFilter}
     GROUP BY i.id, i.name ORDER BY count DESC LIMIT 20`, params);
  return r.rows;
}

async function getCountries(scope) {
  if (!scope) throw new Error("getCountries requires scope");
  // Country counts via the NORMALIZED entity model: publications → affiliated_with
  // → institutions.country, a plain indexed join + GROUP BY. Replaces the old
  // path that shredded the 57MB denormalized `affiliations` JSON on every read
  // (~1s). Country is now persisted on `institutions` at ingest by the
  // InstitutionGovernor, so reading it is the same cheap join as collaborators.
  const f = await resolvePubFilter(scope);
  const r = await sql.query(
    `SELECT i.country AS country, COUNT(DISTINCT p.id) AS count
       FROM publications p
       JOIN affiliated_with aw ON aw.publication_id = p.id
       JOIN institutions i ON i.id = aw.institution_id
      WHERE i.country IS NOT NULL AND i.country <> ''
        AND ${f.where}
      GROUP BY i.country
      ORDER BY count DESC
      LIMIT 20`, f.params);
  return r.rows.map((row) => ({ country: row.country, count: parseInt(row.count) }));
}

// Top journals — venues + published_in, journals only (ISSN siblings already
// collapsed into one venue by name_key). key = venue id.
async function getTopJournals(scope) {
  if (!scope) throw new Error("getTopJournals requires scope");
  const f = await resolvePubFilter(scope);
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

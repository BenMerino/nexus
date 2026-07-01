const { sql } = require("./sql");
const { resolvePubFilter } = require("./stats-scope");
const { normRor } = require("./entity-normalize");

// Categorical "top-N by entity" stat readers (institutions / countries /
// journals), extracted from dashboard-stats.js at the N5 150-line boundary.
// Each is a scope-narrowed GROUP BY over an edge table; imported back and
// re-exported by dashboard-stats.js so caller import paths are unchanged.

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
  // COUNT(*), not COUNT(DISTINCT p.id): affiliated_with's PK is
  // (publication_id, institution_id), so per institution each publication
  // appears exactly once, and the p-join is 1:1 on aw.publication_id — no row
  // multiplication. COUNT(*) is therefore provably equal to the distinct-pub
  // count but skips the DISTINCT dedup over the ~280k-row fanout (verified on
  // prod: 806ms -> 93ms, identical answers). The p-join stays: f.where narrows
  // scope over `p` (public EXISTS-ROR / personal authorship / unit).
  const r = await sql.query(
    `SELECT i.name value, i.id::text group_key, COUNT(*) count
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
  // Dedup (publication, country) FIRST, then count — instead of
  // COUNT(DISTINCT p.id) over the raw fanout. A paper affiliating several
  // institutions that share a country produced duplicate rows the outer DISTINCT
  // had to collapse across the whole ~280k-row join (458ms on prod); collapsing
  // to distinct (pub, country) pairs in the inner SELECT and plain-counting them
  // is the same answer for a fraction of the work (verified on prod: 458ms ->
  // 150ms, identical counts). f.where still narrows scope over `p`.
  const f = await resolvePubFilter(scope);
  const r = await sql.query(
    `SELECT country, COUNT(*) AS count FROM (
       SELECT DISTINCT p.id, i.country
         FROM publications p
         JOIN affiliated_with aw ON aw.publication_id = p.id
         JOIN institutions i ON i.id = aw.institution_id
        WHERE i.country IS NOT NULL AND i.country <> ''
          AND ${f.where}
     ) q
      GROUP BY country
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

module.exports = { getCollaborations, getCountries, getTopJournals };

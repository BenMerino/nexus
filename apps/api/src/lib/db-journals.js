// Journals (venues) listing for the Journals entity page. The venues table
// (name-key identity, ISSN optional) joined to papers via published_in, scoped
// by tenant. Personal-scope users see only venues carrying their own papers;
// admin scope sees the whole tenant. One row per venue with paper/citation
// rollups + the four indexation flags (WoS/Scopus/DOAJ/SciELO).
//
// Paginated + searchable + area-filterable in SQL (LIMIT/OFFSET) — unlike
// public-authors.js's in-memory aggregate, a venue row has no per-request JS
// computation (h-index etc.) worth caching, so paging at the DB is simpler
// and avoids ever materializing all ~17k tenant venues in one response.
const { sql } = require("./sql");
const { isPersonalScope } = require("./scope");

// Each venue's "area" is its dominant OpenAlex top-level concept (level 0 —
// the ~19 coarse domains like Medicine/Physics/Computer science), picked by
// summed concept score across the venue's own papers. Same source
// concept-stats.js uses for the tenant-wide Research Areas rollup, just
// grouped per-venue instead of per-tenant. Shared by listJournals and
// listJournalAreas so the two can never define "area" differently.
const AREA_JOIN = `
  LEFT JOIN LATERAL (
    SELECT c.display_name
    FROM published_in pi2
    JOIN doi_concepts c ON c.doi_record_id = pi2.publication_id
    WHERE pi2.venue_id = v.id AND c.level = 0 AND c.source = 'openalex'
    GROUP BY c.display_name
    ORDER BY SUM(c.score) DESC
    LIMIT 1
  ) area ON true`;

// Scope-branch FROM/JOIN, shared by listJournals and listJournalAreas —
// personal scope narrows published_in → publications the user authored
// (authorship by their author row's orcid); admin/public sees every venue.
function scopedFrom(scope) {
  const { tenantId, orcid } = scope;
  return isPersonalScope(scope)
    ? {
        from: `FROM venues v
               JOIN published_in pi ON pi.venue_id = v.id
               JOIN publications p ON p.id = pi.publication_id
               JOIN authorship a ON a.publication_id = p.id
               JOIN authors au ON au.id = a.author_id AND au.orcid = $1
               ${AREA_JOIN}
               WHERE v.tenant_id = $2`,
        params: [orcid, tenantId],
      }
    : {
        from: `FROM venues v
               LEFT JOIN published_in pi ON pi.venue_id = v.id
               LEFT JOIN publications p ON p.id = pi.publication_id
               ${AREA_JOIN}
               WHERE v.tenant_id = $1`,
        params: [tenantId],
      };
}

// Sortable columns exposed to clients, mirrored from AuthorsTable's roster
// (public-authors.js SORT_FIELDS) — an allowlist so `sort` never reaches SQL
// as a raw column name.
const SORT_COLUMNS = {
  name: "name", paperCount: "paper_count", citationCount: "citation_count",
};

async function listJournals(scope, opts = {}) {
  const page = Math.max(0, opts.page | 0);
  const pageSize = Math.max(1, Math.min(20000, opts.pageSize | 0 || 24));
  const q = (opts.q || "").trim();
  const area = (opts.area || "").trim();
  const sortCol = SORT_COLUMNS[opts.sort] || "paper_count";
  const sortDir = opts.dir === "asc" ? "ASC" : "DESC";
  // Inner query does the per-venue rollup (identical shape for both scope
  // branches, only the FROM/JOIN differs); the outer query applies the
  // post-aggregate area/search filters, a window COUNT for totalCount, and
  // the LIMIT/OFFSET page slice — so filtering never fights the GROUP BY.
  const inner = scopedFrom(scope);

  const params = [...inner.params];
  let outerWhere = "";
  if (q) { params.push(`%${q}%`); outerWhere += ` AND j.name ILIKE $${params.length}`; }
  if (area) { params.push(area); outerWhere += ` AND j.area = $${params.length}`; }
  params.push(pageSize, page * pageSize);

  const result = await sql.query(
    `WITH j AS (
       SELECT v.id, v.issn_l, v.name, v.venue_type, area.display_name AS area,
              v.in_wos, v.in_scopus, v.in_doaj, v.in_scielo,
              COUNT(DISTINCT p.id) AS paper_count,
              COALESCE(SUM(p.citation_count), 0) AS citation_count
       ${inner.from}
       GROUP BY v.id, area.display_name
     )
     SELECT j.*, COUNT(*) OVER() AS total_count
     FROM j
     WHERE TRUE${outerWhere}
     ORDER BY ${sortCol} ${sortDir}, name ASC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  return {
    rows: result.rows.map((r) => ({
      id: r.id,
      issn: r.issn_l,
      name: r.name,
      type: r.venue_type,
      area: r.area,
      paperCount: Number(r.paper_count),
      citationCount: Number(r.citation_count),
      indexation: {
        wos: r.in_wos, scopus: r.in_scopus, doaj: r.in_doaj, scielo: r.in_scielo,
      },
    })),
    page,
    pageSize,
    totalCount: result.rows.length ? Number(result.rows[0].total_count) : 0,
  };
}

// Tenant-wide area → venue-count summary, independent of listJournals'
// pagination — powers the area filter bar, which needs counts across every
// venue, not just the one page currently rendered.
async function listJournalAreas(scope) {
  const inner = scopedFrom(scope);
  const result = await sql.query(
    `WITH j AS (
       SELECT v.id, area.display_name AS area
       ${inner.from}
       GROUP BY v.id, area.display_name
     )
     SELECT area, COUNT(*)::int AS count
     FROM j
     WHERE area IS NOT NULL
     GROUP BY area
     ORDER BY count DESC`,
    inner.params,
  );
  return result.rows.map((r) => ({ name: r.area, count: r.count }));
}

module.exports = { listJournals, listJournalAreas };

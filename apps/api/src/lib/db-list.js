// Paginated counterparts of getAllRecords / getSubmissions / etc. in
// lib/db.js. Same scope semantics (tenant vs personal), but the SQL
// pushes LIMIT/OFFSET into Postgres via paginatedQuery, returning a
// single page plus the total in one round-trip.
//
// Handlers should call these from any branch that's already opted into
// pagination (e.g. ?paginated=1). The non-paginated getAll* functions
// stay around until the SPA is migrated end-to-end.

const { paginatedQuery } = require("../db/list");
const { isPersonalScope } = require("./scope");
const { personalPaperFilter } = require("./stats-scope");
const { matchClause } = require("./search-match");

// Text columns explore record-search spans — shared with handlers/search.js's
// inline branches so paginated + non-paginated explore match the same fields.
const SEARCH_RECORD_COLS = ["title", "authors", "journal", "doi", "publisher", "venue"];

// /api/records page query.
async function getRecordsPage(scope, query) {
  if (!scope) throw new Error("getRecordsPage requires scope");
  if (isPersonalScope(scope)) {
    const f = personalPaperFilter("id", scope.orcid, scope.tenantId, 1);
    return paginatedQuery({
      baseSql: `SELECT * FROM doi_records WHERE ${f.sql}`,
      baseParams: f.params,
      orderBy: "id DESC",
      query,
    });
  }
  return paginatedQuery({
    baseSql: "SELECT * FROM doi_records WHERE tenant_id = $1",
    baseParams: [scope.tenantId],
    orderBy: "id DESC",
    query,
  });
}

// /api/submissions page query.
async function getSubmissionsPage(scope, query) {
  if (!scope) throw new Error("getSubmissionsPage requires scope");
  if (isPersonalScope(scope)) {
    const f = personalPaperFilter("d.id", scope.orcid, scope.tenantId, 1);
    return paginatedQuery({
      baseSql: `
        SELECT s.*, d.title FROM submissions s
        LEFT JOIN doi_records d ON s.doi = d.doi
        WHERE ${f.sql}
      `,
      baseParams: f.params,
      orderBy: "created_at DESC",
      query,
    });
  }
  return paginatedQuery({
    baseSql: `
      SELECT s.*, d.title FROM submissions s
      LEFT JOIN doi_records d ON s.doi = d.doi
      WHERE d.tenant_id = $1
    `,
    baseParams: [scope.tenantId],
    orderBy: "created_at DESC",
    query,
  });
}

// Search records (paginated) — uses the SAME shared engine (tokenized +
// accent-folded, multi-column) as the non-paginated /search branch and the
// public omnibox, over the same record text columns, so all surfaces match
// identically. An all-stopword query (no usable token) returns empty.
async function searchRecordsPage(scope, term, query) {
  if (!scope) throw new Error("searchRecordsPage requires scope");
  if (!term) return { data: [], total: 0, limit: 0, offset: 0 };
  if (isPersonalScope(scope)) {
    const f = personalPaperFilter("id", scope.orcid, scope.tenantId, 1); // $1,$2
    const m = matchClause(SEARCH_RECORD_COLS, term, f.params.length + 1);
    if (!m.sql) return { data: [], total: 0, limit: 0, offset: 0 };
    return paginatedQuery({
      baseSql: `SELECT * FROM doi_records WHERE ${f.sql} AND (${m.sql})`,
      baseParams: [...f.params, ...m.params],
      orderBy: "id DESC",
      query,
    });
  }
  const m = matchClause(SEARCH_RECORD_COLS, term, 2); // $1 = tenantId
  if (!m.sql) return { data: [], total: 0, limit: 0, offset: 0 };
  return paginatedQuery({
    baseSql: `SELECT * FROM doi_records WHERE tenant_id = $1 AND (${m.sql})`,
    baseParams: [scope.tenantId, ...m.params],
    orderBy: "id DESC",
    query,
  });
}

module.exports = { getRecordsPage, getSubmissionsPage, searchRecordsPage };

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

// /api/records page query.
async function getRecordsPage(scope, query) {
  if (!scope) throw new Error("getRecordsPage requires scope");
  if (isPersonalScope(scope)) {
    return paginatedQuery({
      baseSql: `
        SELECT * FROM doi_records WHERE id IN (
          SELECT doi_record_id FROM tags WHERE category='author' AND ext_id=$1
        )
      `,
      baseParams: [scope.orcid],
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
    return paginatedQuery({
      baseSql: `
        SELECT s.*, d.title FROM submissions s
        LEFT JOIN doi_records d ON s.doi = d.doi
        WHERE d.id IN (
          SELECT doi_record_id FROM tags WHERE category='author' AND ext_id=$1
        )
      `,
      baseParams: [scope.orcid],
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

// Tag stats: group + count, paginated by count desc. Tenant-scoped.
async function getTagStatsPage(scope, query) {
  if (!scope) throw new Error("getTagStatsPage requires scope");
  if (isPersonalScope(scope)) {
    return paginatedQuery({
      baseSql: `
        SELECT t.category, t.value, COUNT(DISTINCT t.doi_record_id) AS count
        FROM tags t
        WHERE t.doi_record_id IN (
          SELECT doi_record_id FROM tags WHERE category='author' AND ext_id=$1
        )
        GROUP BY t.category, t.value
      `,
      baseParams: [scope.orcid],
      orderBy: "count DESC",
      query,
    });
  }
  return paginatedQuery({
    baseSql: `
      SELECT t.category, t.value, COUNT(DISTINCT t.doi_record_id) AS count
      FROM tags t
      JOIN doi_records d ON t.doi_record_id = d.id
      WHERE d.tenant_id = $1
      GROUP BY t.category, t.value
    `,
    baseParams: [scope.tenantId],
    orderBy: "count DESC",
    query,
  });
}

// Search records (full-text-ish): title/journal/authors LIKE term.
async function searchRecordsPage(scope, term, query) {
  if (!scope) throw new Error("searchRecordsPage requires scope");
  if (!term) return { data: [], total: 0, limit: 0, offset: 0 };
  const like = `%${term}%`;
  if (isPersonalScope(scope)) {
    return paginatedQuery({
      baseSql: `
        SELECT * FROM doi_records
        WHERE id IN (SELECT doi_record_id FROM tags WHERE category='author' AND ext_id=$1)
        AND (title ILIKE $2 OR journal ILIKE $2 OR doi ILIKE $2 OR publisher ILIKE $2 OR venue ILIKE $2)
      `,
      baseParams: [scope.orcid, like],
      orderBy: "id DESC",
      query,
    });
  }
  return paginatedQuery({
    baseSql: `
      SELECT * FROM doi_records
      WHERE tenant_id = $1
      AND (title ILIKE $2 OR journal ILIKE $2 OR doi ILIKE $2 OR publisher ILIKE $2 OR venue ILIKE $2)
    `,
    baseParams: [scope.tenantId, like],
    orderBy: "id DESC",
    query,
  });
}

module.exports = { getRecordsPage, getSubmissionsPage, getTagStatsPage, searchRecordsPage };

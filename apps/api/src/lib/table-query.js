// Pagination contract ported from Zincro's TableQuery/PaginatedResult pattern
// (apps/api/src/lib/pagination). Same vocabulary shared by API + frontend:
//   TableQuery  { page (0-indexed), pageSize, sort {columnId,direction}|null, search }
//   PaginatedResult { rows, totalCount, page, pageSize }
//
// parseTableQuery validates against a per-resource schema. Critically, the
// sort column is whitelisted against schema.sortable — an unknown column is
// rejected, which closes SQL injection via the `sort` param (the column name
// can't be a bound parameter, so it must be validated, not escaped).

const DEFAULT_PAGE_SIZE = 50;
const ABSOLUTE_MAX_PAGE_SIZE = 200;

class TableQueryValidationError extends Error {}

function asString(v) {
  if (v == null) return undefined;
  if (Array.isArray(v)) return v[0] != null ? String(v[0]) : undefined;
  return String(v);
}

function clampInt(raw, fallback, min, max) {
  if (raw == null || raw === "") return fallback;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

// schema: { sortable: { colId: "sql_expr", ... }, defaultSort, maxPageSize, parseFilters? }
function parseTableQuery(raw, schema) {
  const page = clampInt(asString(raw.page), 0, 0, Number.MAX_SAFE_INTEGER);
  const requestedSize = clampInt(asString(raw.pageSize), DEFAULT_PAGE_SIZE, 1, ABSOLUTE_MAX_PAGE_SIZE);
  const pageSize = Math.min(requestedSize, schema.maxPageSize ?? ABSOLUTE_MAX_PAGE_SIZE);

  const sortColumnId = asString(raw.sort);
  const sortDir = asString(raw.dir);
  let sort = schema.defaultSort ?? null;
  if (sortColumnId) {
    if (!Object.prototype.hasOwnProperty.call(schema.sortable, sortColumnId)) {
      throw new TableQueryValidationError(`Unknown sort column: ${sortColumnId}`);
    }
    const direction = sortDir === "asc" || sortDir === "desc" ? sortDir : "desc";
    sort = { columnId: sortColumnId, direction };
  }

  const search = (asString(raw.q) ?? "").trim();
  const filters = schema.parseFilters ? schema.parseFilters(raw) : {};
  return { page, pageSize, sort, filters, search };
}

module.exports = { parseTableQuery, TableQueryValidationError, DEFAULT_PAGE_SIZE };

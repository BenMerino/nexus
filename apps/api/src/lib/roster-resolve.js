const { sql } = require("./sql");
const { searchAuthorsAtInstitution } = require("./openalex");

const ORCID_RE = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;

function normalizeOrcid(raw) {
  const s = (raw || "").trim().replace("https://orcid.org/", "");
  return ORCID_RE.test(s) ? s : null;
}

// Build the OpenAlex search query from a roster name
// ("Surname1 Surname2 Given1 Given2"). Verified against live UTalca data:
// using just FIRST given + FIRST surname (e.g. "Ariela Vergara") matches far
// more profiles than the full 4-token name, which over-constrains the search.
function searchQuery(fullName) {
  const t = (fullName || "").trim().split(/\s+/);
  if (t.length >= 3) return `${t[2]} ${t[0]}`;
  return fullName;
}

// SUGGEST (never writes): for each ORCID-less academic, search OpenAlex under
// the tenant's ROR and return candidate profiles for a human to confirm.
// Candidates carry worksCount so the admin can judge which profile is real.
async function suggestOrcids(tenantId, ror, limit = 30, offset = 0) {
  const { rows: users } = await sql`
    SELECT id, full_name FROM users
    WHERE tenant_id = ${tenantId} AND role = 'academic'
      AND (orcid IS NULL OR orcid = '')
    ORDER BY full_name LIMIT ${limit} OFFSET ${offset}`;
  const { rows: countRows } = await sql`
    SELECT COUNT(*)::int AS n FROM users
    WHERE tenant_id = ${tenantId} AND role = 'academic'
      AND (orcid IS NULL OR orcid = '')`;

  const rows = [];
  for (const u of users) {
    let candidates = [];
    try {
      candidates = await searchAuthorsAtInstitution(searchQuery(u.full_name), ror);
    } catch { /* leave candidates empty on lookup failure */ }
    rows.push({ userId: u.id, fullName: u.full_name, candidates });
  }
  const total = countRows[0].n;
  return { rows, total, offset, nextOffset: offset + users.length, done: offset + users.length >= total };
}

// WRITE: persist only the (userId, orcid) pairs the admin confirmed. Validates
// ORCID format and scopes every update to the tenant. Returns per-row outcome.
async function saveOrcids(tenantId, assignments) {
  const result = { saved: 0, invalid: [], skipped: 0 };
  for (const a of assignments || []) {
    const orcid = normalizeOrcid(a.orcid);
    if (!a.userId) { result.skipped++; continue; }
    if (!orcid) { result.invalid.push({ userId: a.userId, orcid: a.orcid }); continue; }
    await sql`UPDATE users SET orcid = ${orcid} WHERE id = ${a.userId} AND tenant_id = ${tenantId}`;
    result.saved++;
  }
  return result;
}

// Whitelist of sortable columns → safe SQL expressions. The key is what the
// client sends as `sort`; the value is interpolated as the ORDER BY target.
// Because only these fixed expressions can be selected, the sort param can
// never inject SQL (see table-query.js parseTableQuery).
const ROSTER_SORT = {
  name: "u.full_name",
  department: "u.department",
  faculty: "u.faculty",
  category: "u.profile_category",
  orcid: "u.orcid",
  papers: "paper_count",
};
const ROSTER_SORT_DEFAULT = { columnId: "name", direction: "asc" };

// Paginated/sorted/searchable roster query. Returns a PaginatedResult.
// query: { page, pageSize, sort:{columnId,direction}|null, search }.
// Built via sql.query (dynamic text + params) because the tagged-template
// helper can't compose a shared FROM/WHERE fragment across count + rows.
async function queryRoster(tenantId, query) {
  const sort = query.sort || ROSTER_SORT_DEFAULT;
  const orderExpr = ROSTER_SORT[sort.columnId] || ROSTER_SORT.name; // whitelist → safe
  const dir = sort.direction === "asc" ? "ASC" : "DESC";
  const search = query.search ? `%${query.search}%` : null;

  // $1 tenantId, $2 search (nullable). Column/direction are from the fixed
  // whitelist, never user input, so interpolating them is safe.
  const base = `
    FROM users u
    LEFT JOIN (
      SELECT t.ext_id, COUNT(DISTINCT t.doi_record_id) AS n
      FROM tags t JOIN doi_records d ON t.doi_record_id = d.id
      WHERE t.category = 'author' AND d.tenant_id = $1
      GROUP BY t.ext_id
    ) p ON p.ext_id = u.orcid
    WHERE u.tenant_id = $1 AND u.role = 'academic'
      AND u.profile_category IS NOT NULL
      AND ($2::text IS NULL
           OR u.full_name ILIKE $2 OR u.faculty ILIKE $2 OR u.department ILIKE $2)`;

  const countRes = await sql.query(`SELECT COUNT(*)::int AS n ${base}`, [tenantId, search]);
  const totalCount = countRes.rows[0].n;

  const rowsRes = await sql.query(
    `SELECT u.full_name, u.department, u.faculty, u.profile_category, u.orcid,
            COALESCE(p.n, 0)::int AS paper_count
     ${base}
     ORDER BY ${orderExpr} ${dir} NULLS LAST, u.full_name ASC
     LIMIT $3 OFFSET $4`,
    [tenantId, search, query.pageSize, query.page * query.pageSize],
  );

  return { rows: rowsRes.rows, totalCount, page: query.page, pageSize: query.pageSize };
}

module.exports = { suggestOrcids, saveOrcids, queryRoster, ROSTER_SORT, normalizeOrcid, searchQuery };

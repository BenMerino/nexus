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

// List the tenant's academics for the roster overview table. Returns the
// paper count per ORCID-linked academic so the admin sees ingest coverage.
async function listRoster(tenantId) {
  const { rows } = await sql`
    SELECT u.full_name, u.department, u.faculty, u.profile_category, u.orcid,
           COALESCE(p.n, 0)::int AS paper_count
    FROM users u
    LEFT JOIN (
      SELECT t.ext_id, COUNT(DISTINCT t.doi_record_id) AS n
      FROM tags t JOIN doi_records d ON t.doi_record_id = d.id
      WHERE t.category = 'author' AND d.tenant_id = ${tenantId}
      GROUP BY t.ext_id
    ) p ON p.ext_id = u.orcid
    WHERE u.tenant_id = ${tenantId} AND u.role = 'academic'
      AND u.profile_category IS NOT NULL
    ORDER BY u.full_name`;
  return rows;
}

module.exports = { suggestOrcids, saveOrcids, listRoster, normalizeOrcid, searchQuery };

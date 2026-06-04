// Shared scope-narrowing for entity-backed stats readers (tags → entities).
// Returns a parameterized WHERE fragment over a `publications p` alias:
//   personal scope → p is one of the user's own papers (authorship by ORCID)
//   admin/tenant   → p belongs to the tenant
// This is the entity replacement for the legacy
//   `id IN (SELECT doi_record_id FROM tags WHERE category='author' AND ext_id=orcid)`
// filter that recurred across the stats/list readers. Callers using sql.query
// append their own params after f.params (offset by f.params.length).

const { sql } = require("./sql");
const { isPersonalScope } = require("./scope");
const { normOrcid } = require("./entity-normalize");
const { nameKey, parseUnitKey } = require("./org-units");

function scopedPubFilter(scope) {
  if (isPersonalScope(scope)) {
    // $1 = bare ORCID, $2 = tenantId. Narrow to publications the user authored.
    return {
      where: `p.id IN (
        SELECT s.publication_id FROM authorship s JOIN authors a ON a.id = s.author_id
        WHERE a.orcid = $1 AND a.tenant_id = $2)`,
      params: [normOrcid(scope.orcid), scope.tenantId],
    };
  }
  return { where: `p.tenant_id = $1`, params: [scope.tenantId] };
}

// Personal-scope "papers I authored" filter as a SQL fragment for an arbitrary
// id column, with param placeholders starting at `startIdx`. For readers that
// build positional SQL by hand (db-list pagination, some handlers) — the entity
// replacement for `<idCol> IN (SELECT doi_record_id FROM tags WHERE category='author' AND ext_id=$n)`.
function personalPaperFilter(idCol, orcid, tenantId, startIdx) {
  return {
    sql: `${idCol} IN (
      SELECT s.publication_id FROM authorship s JOIN authors a ON a.id = s.author_id
      WHERE a.orcid = $${startIdx} AND a.tenant_id = $${startIdx + 1})`,
    params: [normOrcid(orcid), tenantId],
  };
}

// Resolve an org-unit `unitKey` to a publications WHERE fragment scoping to the
// papers authored by academics in that faculty/department. Async because it
// resolves the key against THIS tenant's own roster literals (accent-safe,
// JS-side via nameKey) — so a key forged from another tenant matches nothing
// (N1: never trust the raw key as SQL; it only ever selects from this tenant's
// faculty/department strings). A faculty-level key rolls up all its departments
// (matches on faculty only); a dept-level key matches faculty + department.
// Returns null if the key is malformed or matches no unit (caller falls back to
// the tenant-wide filter rather than silently returning everything).
async function unitPubFilter(unitKey, tenantId) {
  const parsed = parseUnitKey(unitKey);
  if (!parsed) return null;

  // Distinct faculty/department literals this tenant actually has, so we match
  // on real strings (the unitKey carries normalized keys, the DB holds the
  // original accented literals).
  const { rows } = await sql`
    SELECT DISTINCT faculty, department FROM users
    WHERE tenant_id = ${tenantId} AND role = 'academic' AND profile_category IS NOT NULL`;

  // Collect the literal (faculty, department) pairs whose normalized keys match.
  const facLits = new Set();
  const pairLits = []; // [faculty, department] for dept-level keys
  for (const r of rows) {
    const fk = nameKey(r.faculty);
    if (parsed.level === "faculty" && fk === parsed.facultyKey) facLits.add(r.faculty);
    else if (parsed.level === "dept" && fk === parsed.facultyKey && nameKey(r.department) === parsed.deptKey) {
      pairLits.push([r.faculty, r.department]);
    } else if (parsed.level === "other" && nameKey(r.department || r.faculty) === parsed.subKey) {
      // "Otras unidades" children: the unit literal lives in department, or in
      // faculty when the person is filed at the (non-academic) faculty level.
      pairLits.push([r.faculty, r.department]);
    }
  }

  // Build the user-side predicate from the matched literals.
  let userWhere;
  const params = [tenantId];
  if (parsed.level === "faculty") {
    if (facLits.size === 0) return null;
    const ph = [...facLits].map((lit) => { params.push(lit); return `$${params.length}`; });
    userWhere = `u.faculty IN (${ph.join(", ")})`;
  } else {
    if (pairLits.length === 0) return null;
    const ph = pairLits.map(([f, d]) => {
      params.push(f, d);
      return `(u.faculty IS NOT DISTINCT FROM $${params.length - 1} AND u.department IS NOT DISTINCT FROM $${params.length})`;
    });
    userWhere = ph.join(" OR ");
  }

  return {
    where: `p.id IN (
      SELECT s.publication_id FROM authorship s
      JOIN authors a ON a.id = s.author_id
      JOIN users u ON u.orcid = a.orcid AND u.tenant_id = $1
      WHERE ${userWhere})`,
    params,
  };
}

// Async filter resolver the stats readers use: when scope.unitKey is present
// it narrows to that org unit (async — needs a roster lookup); otherwise it
// returns the plain sync scopedPubFilter result. A unitKey that resolves to no
// unit falls back to the tenant filter (an empty result would be misleading;
// the caller validated tenant membership of the key upstream). Personal scope
// is never combined with a unit (units are a tenant/public view), so unitKey
// takes precedence only for non-personal scope.
async function resolvePubFilter(scope) {
  if (scope && scope.unitKey && !isPersonalScope(scope)) {
    const u = await unitPubFilter(scope.unitKey, scope.tenantId);
    if (u) return u;
  }
  return scopedPubFilter(scope);
}

module.exports = { scopedPubFilter, personalPaperFilter, unitPubFilter, resolvePubFilter };

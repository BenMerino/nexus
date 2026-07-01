// Org-unit (faculty/department) scope resolution for the stats readers. Split
// from stats-scope.js (N5) — this is the roster-driven unit narrowing; the core
// per-scope pub filter stays in stats-scope. Both resolvers match the unitKey's
// normalized keys against THIS tenant's own faculty/department literals
// (accent-safe, JS-side via nameKey), so a key forged from another tenant
// matches nothing (N1: the raw key never becomes SQL).

const { sql } = require("./sql");
const { normOrcid } = require("./entity-normalize");
const { nameKey, parseUnitKey, classifyUnit } = require("./org-units");

// Resolve an org-unit `unitKey` to a publications WHERE fragment scoping to the
// papers authored by academics in that faculty/department. A faculty-level key
// rolls up all its departments (matches on faculty only); a dept-level key
// matches faculty + department. Returns null if the key is malformed or matches
// no unit (caller falls back to the tenant-wide filter rather than silently
// returning everything).
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

// Resolve an org-unit `unitKey` to the SET of academic ORCIDs that belong to
// that unit (the unit's members, not their papers). Used to filter the author
// directory to a faculty/department. Returns null for a malformed/unmatched key
// so callers fall back to the full directory.
async function unitOrcids(unitKey, tenantId) {
  const parsed = parseUnitKey(unitKey);
  if (!parsed) return null;
  const { rows } = await sql`
    SELECT faculty, department, orcid FROM users
    WHERE tenant_id = ${tenantId} AND role = 'academic' AND profile_category IS NOT NULL
      AND orcid IS NOT NULL`;
  const out = new Set();
  for (const r of rows) {
    const fk = nameKey(r.faculty);
    const match =
      parsed.level === "faculty" ? fk === parsed.facultyKey
      : parsed.level === "dept" ? (fk === parsed.facultyKey && nameKey(r.department) === parsed.deptKey)
      : nameKey(r.department || r.faculty) === parsed.subKey; // "other"
    if (match) out.add(normOrcid(r.orcid));
  }
  return out.size ? out : null;
}

// ORCID → faculty display name, from the roster (classifyUnit-normalized —
// the same grouping org-tree.js/public-author.js use, so a directory's
// Faculty column always agrees with the Faculties view). Used by
// public-authors.js's aggregateAuthors to add a faculty column without a
// per-row roster lookup.
async function rosterFacultyByOrcid(tenantId) {
  const { rows } = await sql`
    SELECT orcid, faculty FROM users
    WHERE tenant_id = ${tenantId} AND role = 'academic' AND orcid IS NOT NULL`;
  const out = new Map();
  for (const r of rows) {
    const orcid = normOrcid(r.orcid);
    if (orcid) out.set(orcid, classifyUnit(r.faculty).group);
  }
  return out;
}

module.exports = { unitPubFilter, unitOrcids, rosterFacultyByOrcid };

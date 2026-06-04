// Org-unit dimension — the canonical derivation of a stable `unitKey` for a
// faculty / department / "otras unidades" node of the org tree.
//
// DGA note: an org unit has NO independent write lifecycle (it's derived from
// the roster — faculty/department are Author/user profile fields). So this is
// NOT a governed domain — it's a READ dimension the Statistician owns. This
// file is the single source of the unitKey grammar + the classify() rule
// (lifted out of org-tree.js so the tree and the stats filter agree exactly).

const OTHER = "Otras unidades (no académicas)";

// Normalize a name to a stable key: lowercase, strip accents, collapse and
// trim whitespace. Accent-strip via NFD so "Ingeniería" === "ingenieria".
function nameKey(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Classify a faculty literal into the academic tier the UTalca org chart shows
// (RU N°1053-2025): Facultades + Institutos are peers; everything else groups
// under one "Otras unidades" node. Lifted verbatim from org-tree.js so the
// tree grouping and the unitKey derivation can never drift.
function classifyUnit(faculty) {
  const s = (faculty || "").toLowerCase();
  if (s.startsWith("facultad")) return { group: faculty, kind: "faculty" };
  if (s.startsWith("instituto")) return { group: faculty, kind: "institute" };
  return { group: OTHER, kind: "other", sub: faculty }; // Programas, Direcciones
}

// unitKey grammar (URL-safe, reversible to the SQL filter):
//   faculty/institute node → "fac:<facKey>"
//   department node        → "dep:<facKey>:<depKey>"
//   "Otras unidades" child → "oth:<subKey>"
// `group` is the faculty/group literal; `dept` the department literal (or the
// program/direccion literal for the "other" branch).
function unitKeyForNode(kind, group, dept) {
  if (kind === "other") return `oth:${nameKey(dept)}`;
  const facKey = nameKey(group);
  // department-level nodes carry both; "(sin unidad)" leaves stay at fac level.
  if (dept && dept !== "(sin unidad)") return `dep:${facKey}:${nameKey(dept)}`;
  return `fac:${facKey}`;
}

// Reverse a unitKey into its match parts. The caller resolves these against the
// tenant's own roster literals (JS-side, accent-safe) — never trusts the raw
// key as SQL — so a key from another tenant simply matches nothing.
function parseUnitKey(unitKey) {
  if (typeof unitKey !== "string") return null;
  const [level, ...rest] = unitKey.split(":");
  if (level === "fac" && rest.length === 1) return { level: "faculty", facultyKey: rest[0] };
  if (level === "dep" && rest.length === 2) return { level: "dept", facultyKey: rest[0], deptKey: rest[1] };
  if (level === "oth" && rest.length === 1) return { level: "other", subKey: rest[0] };
  return null;
}

module.exports = { OTHER, nameKey, classifyUnit, unitKeyForNode, parseUnitKey };

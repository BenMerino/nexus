// Shared diff machinery for the tags→entities reader migrations. Each cluster's
// diff script (diff-dashboard-stats.js, and the detail/coauthor clusters to come)
// compares OLD (tag) vs NEW (entity) aggregates with the SAME proven invariants:
//   • venue/institution counts may only RISE (sibling-ISSN recovery — NEW catches
//     papers whose tagged ISSN was a sibling), never lose a real entity;
//   • a "lost" OLD key is benign iff explained by a sanctioned merge (an
//     institution ROR folded into a canonical, or an ISSN-dedup venue alias).
// All of this was proven zero-drift structurally in the graph migration
// (scripts/diff-graph-entities.js) over the same published_in/affiliated_with edges.

const { sql } = require("../src/lib/sql");
const { journalNameKey } = require("../src/lib/journal-canon");
const { scopedPubFilter } = require("../src/lib/stats-scope");

// Exact compare (JSON) for scalar/year maps.
function cmp(label, a, b) {
  const A = JSON.stringify(a), B = JSON.stringify(b);
  const ok = A === B;
  console.log(`${ok ? "OK " : "DRIFT"}  ${label}`);
  if (!ok) { console.log("   OLD:", A.slice(0, 300)); console.log("   NEW:", B.slice(0, 300)); }
  return ok;
}

// Venue/inst map compare: OK when NEW loses no key and NEW[k] >= OLD[k]
// everywhere, EXCEPT keys explained by a merge (mergedAway). Else DRIFT.
function cmpVenueMap(label, oldM, newM, mergedAway) {
  const lostKeys = Object.keys(oldM).filter((k) => !(k in newM) && !mergedAway.has(k));
  const underCount = Object.keys(oldM).filter((k) => (newM[k] || 0) < oldM[k] && !mergedAway.has(k));
  const recovered = Object.keys(oldM).filter((k) => (newM[k] || 0) > oldM[k]).length;
  const ok = lostKeys.length === 0 && underCount.length === 0;
  console.log(`${ok ? "OK " : "DRIFT"}  ${label} (${Object.keys(oldM).length} keys, ${recovered} recovered higher; ${lostKeys.length} lost, ${underCount.length} under-counted)`);
  if (!ok) {
    console.log("   LOST:", JSON.stringify(lostKeys.slice(0, 10)));
    console.log("   UNDER:", JSON.stringify(underCount.slice(0, 10).map((k) => `${k}:${oldM[k]}→${newM[k] || 0}`)));
  }
  return ok;
}

// OLD per-key paper-count map from tags, over a `doi_records d` WHERE clause
// {w, p}. Institutions key by ROR (stable id; name is cosmetic), journals by
// name_key (ISSN siblings collapse). category ∈ journal|non-journal|institution.
async function oldVenueMap(where, category) {
  const { w, p } = where;
  const sel = category === "institution"
    ? `SELECT regexp_replace(t.ext_id,'^https?://ror\\.org/','') k, t.doi_record_id pub FROM tags t JOIN doi_records d ON d.id=t.doi_record_id WHERE t.category='institution' AND t.ext_id IS NOT NULL AND ${w}`
    : `SELECT t.value, t.doi_record_id pub FROM tags t JOIN doi_records d ON d.id=t.doi_record_id WHERE t.category='${category}' AND ${w}`;
  const r = await sql.query(sel, p);
  const byKey = new Map();
  for (const x of r.rows) {
    const k = category === "institution" ? x.k : journalNameKey(x.value);
    if (!byKey.has(k)) byKey.set(k, new Set());
    byKey.get(k).add(x.pub);
  }
  const m = {}; for (const [k, s] of byKey) m[k] = s.size;
  return m;
}

// NEW per-key map from entities (institutions by ROR via affiliated_with;
// journals by name_key via venues+published_in), scoped by `scope`.
async function newVenueMap(scope, vtype) {
  const f = scopedPubFilter(scope);
  if (vtype === "institution") {
    const r = await sql.query(`SELECT i.ror, COUNT(DISTINCT p.id) c FROM affiliated_with aw
      JOIN institutions i ON i.id=aw.institution_id JOIN publications p ON p.id=aw.publication_id
      WHERE i.tenant_id=$${f.params.length+1} AND ${f.where} GROUP BY i.ror`, [...f.params, scope.tenantId]);
    const m = {}; for (const x of r.rows) m[x.ror] = +x.c;
    return m;
  }
  const r = await sql.query(`SELECT e.name, COUNT(DISTINCT p.id) c FROM venues e
    JOIN published_in pi ON pi.venue_id=e.id JOIN publications p ON p.id=pi.publication_id
    WHERE e.tenant_id=$${f.params.length+1} AND e.venue_type='journal' AND ${f.where} GROUP BY e.id, e.name`, [...f.params, scope.tenantId]);
  const m = {}; for (const x of r.rows) m[journalNameKey(x.name)] = (m[journalNameKey(x.name)] || 0) + +x.c;
  return m;
}

// Keys explained by a sanctioned merge (benign "lost"): institution variant
// RORs absent from `institutions` (merged into canonical), and journal name-keys
// whose ISSN belongs to a venue stored under a different name_key (ISSN-dedup).
async function mergedAwayKeys(tenantId) {
  const s = new Set();
  const oldRors = (await sql`SELECT DISTINCT regexp_replace(t.ext_id,'^https?://ror\\.org/','') ror
    FROM tags t JOIN publications p ON p.id=t.doi_record_id
    WHERE t.category='institution' AND t.ext_id IS NOT NULL AND p.tenant_id=${tenantId}`).rows.map((r) => r.ror);
  const liveRors = new Set((await sql`SELECT ror FROM institutions WHERE tenant_id=${tenantId}`).rows.map((r) => r.ror));
  for (const ror of oldRors) if (!liveRors.has(ror)) s.add(ror);
  const rows = (await sql`SELECT DISTINCT t.value, t.ext_id FROM tags t JOIN publications p ON p.id=t.doi_record_id
    WHERE t.category IN ('journal','non-journal') AND t.ext_id IS NOT NULL AND p.tenant_id=${tenantId}`).rows;
  const venueKeyByIssn = new Map(
    (await sql`SELECT issn_l, name_key FROM venues WHERE tenant_id=${tenantId} AND issn_l IS NOT NULL`).rows
      .map((v) => [v.issn_l, v.name_key]));
  for (const r of rows) {
    const k = journalNameKey(r.value);
    const surviving = venueKeyByIssn.get(r.ext_id);
    if (surviving && surviving !== k) s.add(k);
  }
  return s;
}

module.exports = { cmp, cmpVenueMap, oldVenueMap, newVenueMap, mergedAwayKeys };

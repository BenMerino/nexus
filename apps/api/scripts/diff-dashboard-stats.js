// Diff gate for the dashboard-stats tags→entities migration. Compares the OLD
// (tag-based) result of each stat function against the NEW (entity-based) one,
// for admin scope (tenant 1) AND a personal scope (a real ORCID with papers).
// READ-ONLY. The OLD queries are inlined here as the baseline; the NEW ones are
// require()'d from the migrated module.
//
//   railway ssh --service Nexus "cd /app/apps/api && node scripts/diff-dashboard-stats.js"

const { sql } = require("../src/lib/sql");
const NEW = require("../src/lib/dashboard-stats");

// ---- OLD (tag-based) baselines, copied from pre-migration dashboard-stats ----
// OLD WHERE over `doi_records d`: personal → $1=orcid; admin → $1=tenantId.
// Built as plain text+params (the `sql` tagged-template can't nest a fragment).
const oldWhere = (scope, personal) => personal
  ? { w: `d.id IN (SELECT doi_record_id FROM tags WHERE category='author' AND ext_id=$1)`, p: [scope.orcid] }
  : { w: `d.tenant_id = $1`, p: [scope.tenantId] };

async function oldSummary(scope, personal) {
  const { w, p } = oldWhere(scope, personal);
  const r = await sql.query(`SELECT COUNT(*) total_pubs, COALESCE(SUM(citation_count),0) total_citations,
      COUNT(DISTINCT CASE WHEN open_access THEN doi END) oa_count FROM doi_records d WHERE ${w}`, p);
  const a = personal
    ? await sql.query(`SELECT COUNT(DISTINCT COALESCE(ext_id,value)) count FROM tags
        WHERE category='author' AND doi_record_id IN (SELECT doi_record_id FROM tags WHERE category='author' AND ext_id=$1)`, [scope.orcid])
    : await sql.query(`SELECT COUNT(DISTINCT COALESCE(t.ext_id,t.value)) count FROM tags t
        JOIN doi_records d ON d.id=t.doi_record_id WHERE t.category='author' AND d.tenant_id=$1`, [scope.tenantId]);
  return { totalPubs: +r.rows[0].total_pubs, totalCitations: +r.rows[0].total_citations,
    oaCount: +r.rows[0].oa_count, authorCount: +a.rows[0].count };
}
// Full per-name-key paper-count map from OLD tags, collapsing ISSN siblings the
// SAME way venues do (journalNameKey + COUNT(DISTINCT paper)). Compared against
// the NEW full map — apples-to-apples, unbounded (top-N capping is presentation).
const { journalNameKey } = require("../src/lib/journal-canon");
async function oldVenueMap(scope, personal, category) {
  const { w, p } = oldWhere(scope, personal);
  const r = await sql.query(`SELECT t.value, t.doi_record_id pub FROM tags t JOIN doi_records d ON d.id=t.doi_record_id
    WHERE t.category='${category}' AND ${w}`, p);
  const byKey = new Map(); // nameKey -> Set(pub)
  for (const x of r.rows) {
    const k = journalNameKey(x.value);
    if (!byKey.has(k)) byKey.set(k, new Set());
    byKey.get(k).add(x.pub);
  }
  const m = {}; for (const [k, s] of byKey) m[k] = s.size;
  return m;
}
// NEW full map from the migrated reader's underlying tables (venue/institution
// by name_key, COUNT(DISTINCT pub)) — mirrors getTopJournals/getCollaborations
// minus the LIMIT.
async function newVenueMap(scope, vtype) {
  const { scopedPubFilter } = require("../src/lib/stats-scope");
  const f = scopedPubFilter(scope);
  const tbl = vtype === "institution"
    ? `affiliated_with aw JOIN institutions e ON e.id=aw.institution_id JOIN publications p ON p.id=aw.publication_id WHERE e.tenant_id=$${f.params.length+1} AND ${f.where}`
    : `venues e JOIN published_in pi ON pi.venue_id=e.id JOIN publications p ON p.id=pi.publication_id WHERE e.tenant_id=$${f.params.length+1} AND e.venue_type='journal' AND ${f.where}`;
  const r = await sql.query(`SELECT e.name, COUNT(DISTINCT p.id) c FROM ${tbl} GROUP BY e.id, e.name`, [...f.params, scope.tenantId]);
  const m = {}; for (const x of r.rows) m[journalNameKey(x.name)] = (m[journalNameKey(x.name)] || 0) + +x.c;
  return m;
}

// ---- comparison helpers ----
function cmp(label, a, b) {
  const A = JSON.stringify(a), B = JSON.stringify(b);
  const ok = A === B;
  console.log(`${ok ? "OK " : "DRIFT"}  ${label}`);
  if (!ok) { console.log("   OLD:", A.slice(0, 300)); console.log("   NEW:", B.slice(0, 300)); }
  return ok;
}

// Venue/inst maps: OLD vs NEW differ ONLY by (a) the documented sibling-ISSN
// recovery (NEW catches papers whose tagged ISSN was a sibling — NEW[k] >= OLD[k]),
// and (b) merge survivors: a few venues/institutions were merged (ISSN-dedup like
// RIVAR/EPL; synonym merges like the 3 institutions), so OLD's VARIANT name-key
// is gone and its papers moved to the canonical name-key. Both were proven
// zero-drift structurally in the graph migration (same published_in/affiliated_with
// edges, scripts/diff-graph-entities.js). So the gate excludes keys explained by a
// merge: a "lost" OLD key is benign iff its name was a tag_synonyms variant OR an
// ISSN-merged venue alias (i.e. it shares an ISSN with a surviving venue). Anything
// NOT so explained = real drift.
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

// Name-keys explained by a sanctioned merge (so a "lost" OLD key is benign):
// institution synonym variants + venues that share an ISSN with a surviving venue.
async function mergedAwayKeys(tenantId) {
  const s = new Set();
  for (const r of (await sql`SELECT DISTINCT variant FROM tag_synonyms WHERE tenant_id=${tenantId} AND category='institution'`).rows)
    s.add(journalNameKey(r.variant));
  // ISSN-merged venue aliases: a journal/non-journal tag name whose ISSN belongs
  // to a venue stored under a DIFFERENT name_key (the merge survivor).
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

async function main() {
  let drift = 0;
  const merged = await mergedAwayKeys(1);
  // A real personal-scope ORCID (most papers) for tenant 1.
  const top = (await sql`SELECT a.orcid, COUNT(*) n FROM authorship s JOIN authors a ON a.id=s.author_id
    WHERE a.tenant_id=1 GROUP BY a.orcid ORDER BY n DESC LIMIT 1`).rows[0];
  const scopes = [
    { label: "admin", scope: { tenantId: 1, role: "superadmin", orcid: null, ror: null }, personal: false },
    { label: "personal", scope: { tenantId: 1, role: "academic", orcid: top.orcid, ror: null }, personal: true },
  ];
  for (const { label, scope, personal } of scopes) {
    if (!cmp(`${label} getSummary`, await oldSummary(scope, personal), await NEW.getSummary(scope))) drift++;
    // Journals/collaborations: compare FULL per-name-key paper-count maps (OLD
    // collapses ISSN siblings in JS like venues do) — apples-to-apples, unbounded.
    if (!cmpVenueMap(`${label} journals`, await oldVenueMap(scope, personal, "journal"), await newVenueMap(scope, "journal"), merged)) drift++;
    if (!cmpVenueMap(`${label} collaborations`, await oldVenueMap(scope, personal, "institution"), await newVenueMap(scope, "institution"), merged)) drift++;
    // getByYearAndSource: source dim dropped by design — compare year→count totals only.
    const { w, p } = oldWhere(scope, personal);
    const oldYr = {}; for (const r of (await sql.query(`SELECT SUBSTRING(d.published FROM 1 FOR 4) AS year, COUNT(*) AS c FROM doi_records d
      WHERE d.published IS NOT NULL AND ${w} GROUP BY 1`, p)).rows) oldYr[r.year] = +r.c;
    const newYr = {}; for (const r of await NEW.getByYearAndSource(scope)) newYr[r.year] = (newYr[r.year] || 0) + +r.count;
    if (!cmp(`${label} byYear (source-agnostic)`, oldYr, newYr)) drift++;
  }
  console.log(drift === 0 ? "\n✓ dashboard-stats entity migration matches" : `\n✗ ${drift} drift(s)`);
  process.exit(drift === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(2); });

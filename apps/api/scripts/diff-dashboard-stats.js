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

async function main() {
  let drift = 0;
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
    if (!cmp(`${label} journals(full map)`, await oldVenueMap(scope, personal, "journal"), await newVenueMap(scope, "journal"))) drift++;
    if (!cmp(`${label} collaborations(full map)`, await oldVenueMap(scope, personal, "institution"), await newVenueMap(scope, "institution"))) drift++;
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

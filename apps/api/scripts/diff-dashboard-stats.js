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
const personalCond = (orcid) => sql`d.id IN (SELECT doi_record_id FROM tags WHERE category='author' AND ext_id=${orcid})`;

async function oldSummary(scope, personal) {
  const where = personal ? personalCond(scope.orcid) : sql`d.tenant_id = ${scope.tenantId}`;
  const r = await sql`SELECT COUNT(*) total_pubs, COALESCE(SUM(citation_count),0) total_citations,
      COUNT(DISTINCT CASE WHEN open_access THEN doi END) oa_count FROM doi_records d WHERE ${where}`;
  const a = personal
    ? await sql`SELECT COUNT(DISTINCT COALESCE(ext_id,value)) count FROM tags
        WHERE category='author' AND doi_record_id IN (SELECT doi_record_id FROM tags WHERE category='author' AND ext_id=${scope.orcid})`
    : await sql`SELECT COUNT(DISTINCT COALESCE(t.ext_id,t.value)) count FROM tags t
        JOIN doi_records d ON d.id=t.doi_record_id WHERE t.category='author' AND d.tenant_id=${scope.tenantId}`;
  return { totalPubs: +r.rows[0].total_pubs, totalCitations: +r.rows[0].total_citations,
    oaCount: +r.rows[0].oa_count, authorCount: +a.rows[0].count };
}
async function oldCollab(scope, personal) {
  const where = personal ? personalCond(scope.orcid) : sql`d.tenant_id = ${scope.tenantId}`;
  const r = await sql`SELECT MAX(t.value) value, COUNT(*) count FROM tags t JOIN doi_records d ON d.id=t.doi_record_id
    WHERE t.category='institution' AND ${where} GROUP BY COALESCE(t.ext_id,t.value) ORDER BY count DESC LIMIT 20`;
  return r.rows.map((x) => `${x.value}|${x.count}`).sort();
}
async function oldJournals(scope, personal) {
  const where = personal ? personalCond(scope.orcid) : sql`d.tenant_id = ${scope.tenantId}`;
  const r = await sql`SELECT MAX(t.value) value, COUNT(*) count FROM tags t JOIN doi_records d ON d.id=t.doi_record_id
    WHERE t.category='journal' AND ${where} GROUP BY COALESCE(t.ext_id,t.value) ORDER BY count DESC LIMIT 10`;
  return r.rows.map((x) => `${x.value}|${x.count}`).sort();
}

// ---- comparison helpers ----
const sortByKey = (rows, k) => rows.map((r) => `${r[k]}|${r.count}`).sort();
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
    if (!cmp(`${label} getCollaborations`, await oldCollab(scope, personal), sortByKey(await NEW.getCollaborations(scope), "value"))) drift++;
    if (!cmp(`${label} getTopJournals`, await oldJournals(scope, personal), sortByKey(await NEW.getTopJournals(scope), "value"))) drift++;
    // getByYearAndSource: source dim dropped by design — compare year→count totals only.
    const oldYr = {}; for (const r of (await sql`SELECT SUBSTRING(d.published FROM 1 FOR 4) year, COUNT(*) c FROM doi_records d
      WHERE d.published IS NOT NULL AND ${personal ? personalCond(scope.orcid) : sql`d.tenant_id=${scope.tenantId}`} GROUP BY 1`).rows) oldYr[r.year] = +r.c;
    const newYr = {}; for (const r of await NEW.getByYearAndSource(scope)) newYr[r.year] = (newYr[r.year] || 0) + +r.count;
    if (!cmp(`${label} byYear (source-agnostic)`, oldYr, newYr)) drift++;
  }
  console.log(drift === 0 ? "\n✓ dashboard-stats entity migration matches" : `\n✗ ${drift} drift(s)`);
  process.exit(drift === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(2); });

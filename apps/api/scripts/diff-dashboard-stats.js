// Diff gate for the dashboard-stats tags→entities migration. Compares OLD
// (tag-based) vs NEW (entity-based) for admin scope (tenant 1) AND a personal
// scope (a real ORCID with papers). READ-ONLY. Shared venue/inst map machinery +
// merge/sibling invariants live in entity-diff-helpers.js (reused per cluster).
//
//   railway ssh --service Nexus "cd /app/apps/api && node scripts/diff-dashboard-stats.js"

const { sql } = require("../src/lib/sql");
const NEW = require("../src/lib/dashboard-stats");
const { cmp, cmpVenueMap, oldVenueMap, newVenueMap, mergedAwayKeys } = require("./entity-diff-helpers");

// OLD WHERE over `doi_records d`: personal → $1=orcid; admin → $1=tenantId.
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

async function main() {
  let drift = 0;
  const merged = await mergedAwayKeys(1);
  const top = (await sql`SELECT a.orcid, COUNT(*) n FROM authorship s JOIN authors a ON a.id=s.author_id
    WHERE a.tenant_id=1 GROUP BY a.orcid ORDER BY n DESC LIMIT 1`).rows[0];
  const scopes = [
    { label: "admin", scope: { tenantId: 1, role: "superadmin", orcid: null, ror: null }, personal: false },
    { label: "personal", scope: { tenantId: 1, role: "academic", orcid: top.orcid, ror: null }, personal: true },
  ];
  for (const { label, scope, personal } of scopes) {
    const where = oldWhere(scope, personal);
    if (!cmp(`${label} getSummary`, await oldSummary(scope, personal), await NEW.getSummary(scope))) drift++;
    if (!cmpVenueMap(`${label} journals`, await oldVenueMap(where, "journal"), await newVenueMap(scope, "journal"), merged)) drift++;
    if (!cmpVenueMap(`${label} collaborations`, await oldVenueMap(where, "institution"), await newVenueMap(scope, "institution"), merged)) drift++;
    // getByYearAndSource: source dim dropped by design — compare year→count totals only.
    const oldYr = {}; for (const r of (await sql.query(`SELECT SUBSTRING(d.published FROM 1 FOR 4) AS year, COUNT(*) AS c FROM doi_records d
      WHERE d.published IS NOT NULL AND ${where.w} GROUP BY 1`, where.p)).rows) oldYr[r.year] = +r.c;
    const newYr = {}; for (const r of await NEW.getByYearAndSource(scope)) newYr[r.year] = (newYr[r.year] || 0) + +r.count;
    if (!cmp(`${label} byYear (source-agnostic)`, oldYr, newYr)) drift++;
  }
  console.log(drift === 0 ? "\n✓ dashboard-stats entity migration matches" : `\n✗ ${drift} drift(s)`);
  process.exit(drift === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(2); });

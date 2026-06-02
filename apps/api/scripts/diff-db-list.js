// Diff gate for the db-list personal-scope-filter migration (tags author-filter
// → authorship). The transformation is identical to db.js getAllRecords (already
// verified — see HANDOFF-tags-migration.md "db.js personal-scope filter"), applied
// to the paginated variants. Verifies the personal paper-id SET matches OLD, for
// a real ORCID, and (leak guard) a no-match ORCID returns 0. READ-ONLY.
//
//   railway ssh --service Nexus "cd /app/apps/api && node scripts/diff-db-list.js"

const { sql } = require("../src/lib/sql");
const { normOrcid } = require("../src/lib/entity-normalize");

async function oldIds(orcid) {
  const r = await sql.query(
    `SELECT id FROM doi_records WHERE id IN (
       SELECT doi_record_id FROM tags WHERE category='author' AND ext_id=$1)`, [orcid]);
  return new Set(r.rows.map((x) => x.id));
}
async function newIds(orcid, tenantId) {
  const r = await sql.query(
    `SELECT id FROM doi_records WHERE id IN (
       SELECT s.publication_id FROM authorship s JOIN authors a ON a.id=s.author_id
       WHERE a.orcid=$1 AND a.tenant_id=$2)`, [normOrcid(orcid), tenantId]);
  return new Set(r.rows.map((x) => x.id));
}
function cmpSet(label, o, n) {
  const onlyOld = [...o].filter((x) => !n.has(x)).length;
  const onlyNew = [...n].filter((x) => !o.has(x)).length;
  const ok = onlyOld === 0 && onlyNew === 0;
  console.log(`${ok ? "OK " : "DRIFT"}  ${label}: old=${o.size} new=${n.size} onlyOLD=${onlyOld} onlyNEW=${onlyNew}`);
  return ok;
}

async function main() {
  let drift = 0;
  const top = (await sql`SELECT a.orcid FROM authorship s JOIN authors a ON a.id=s.author_id
    WHERE a.tenant_id=1 GROUP BY a.orcid ORDER BY COUNT(*) DESC LIMIT 1`).rows[0].orcid;
  if (!cmpSet("real ORCID paper-id set", await oldIds(top), await newIds(top, 1))) drift++;
  // leak guard: an ORCID with no authorship → empty in both.
  const noMatch = "0000-0000-0000-0000";
  if (!cmpSet("no-match ORCID (leak guard)", await oldIds(noMatch), await newIds(noMatch, 1))) drift++;
  console.log(drift === 0 ? "\n✓ db-list personal filter matches" : `\n✗ ${drift} drift(s)`);
  process.exit(drift === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(2); });

// Diff gate: portfolio.findCollaborators + portfolio-coauthors.buildCoauthorGraph
// (tags → entities). For the top author, compare the coauthor ORCID set (OLD
// author-tag self-join vs NEW authorship self-join) and the suggested-collaborator
// ORCID set. Admin/tenant 1. READ-ONLY.

const { sql } = require("../src/lib/sql");
const { normOrcid } = require("../src/lib/entity-normalize");
const { buildCoauthorGraph } = require("../src/lib/portfolio-coauthors");
const { findCollaborators } = require("../src/lib/portfolio");

function cmpSet(label, o, n) {
  const onlyOld = [...o].filter((x) => !n.has(x)).length;
  const onlyNew = [...n].filter((x) => !o.has(x)).length;
  const ok = onlyOld === 0 && onlyNew === 0;
  console.log(`${ok ? "OK " : "DRIFT"}  ${label}: old=${o.size} new=${n.size} onlyOLD=${onlyOld} onlyNEW=${onlyNew}`);
  return ok;
}

async function main() {
  let drift = 0;
  const orcid = (await sql`SELECT a.orcid FROM authorship s JOIN authors a ON a.id=s.author_id
    WHERE a.tenant_id=1 GROUP BY a.orcid ORDER BY COUNT(*) DESC LIMIT 1`).rows[0].orcid;

  // Coauthor node set: OLD author-tag self-join (bare ext_id) vs NEW graph nodes.
  const oldCo = new Set((await sql`SELECT DISTINCT t2.ext_id k FROM tags t1
    JOIN tags t2 ON t2.doi_record_id=t1.doi_record_id
    WHERE t1.category='author' AND t1.ext_id=${orcid} AND t2.category='author' AND t2.ext_id IS NOT NULL`).rows.map((r) => normOrcid(r.k)));
  const g = await buildCoauthorGraph(orcid);
  const newCo = new Set(g.nodes.map((n) => n.id));
  if (!cmpSet("coauthor node set", oldCo, newCo)) drift++;

  // Suggested collaborators: OLD tag-CTE vs NEW authorship-CTE (set of orcids).
  const oldSug = new Set((await sql.query(
    `WITH tr AS (SELECT DISTINCT t.doi_record_id FROM tags t WHERE t.category='author' AND t.ext_id=$1),
       tc AS (SELECT DISTINCT concept_id FROM doi_concepts WHERE doi_record_id IN (SELECT doi_record_id FROM tr)),
       ec AS (SELECT DISTINCT t.ext_id FROM tags t WHERE t.category='author' AND t.ext_id IS NOT NULL AND t.ext_id<>$1 AND t.doi_record_id IN (SELECT doi_record_id FROM tr))
     SELECT DISTINCT u.orcid FROM users u
     JOIN tags t ON t.category='author' AND t.ext_id=u.orcid
     JOIN doi_concepts dc ON dc.doi_record_id=t.doi_record_id JOIN tc ON tc.concept_id=dc.concept_id
     WHERE u.tenant_id=$2 AND u.orcid IS NOT NULL AND u.orcid<>$1 AND u.orcid NOT IN (SELECT ext_id FROM ec)`,
    [orcid, 1])).rows.map((r) => r.orcid));
  const newSug = new Set((await findCollaborators(orcid, 1, 1000)).map((c) => c.orcid));
  if (!cmpSet("suggested collaborators set", oldSug, newSug)) drift++;

  console.log(drift === 0 ? "\n✓ coauthor + findCollaborators match" : `\n✗ ${drift} drift(s)`);
  process.exit(drift === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(2); });

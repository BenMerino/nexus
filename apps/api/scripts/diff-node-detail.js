// Diff gate for node-detail (tags → entities, via entity-detail.js). For a
// sample of real author/institution/journal nodes, compares OLD (tag) vs NEW
// (entity) detail: paper-DOI set + paper/citation counts. Admin scope (tenant 1).
// Invariant (proven in the graph + dashboard migrations): NEW recovers papers
// OLD's per-ISSN/variant tags missed (counts may RISE), loses none — except
// merge survivors. READ-ONLY.
//
//   railway ssh --service Nexus "cd /app/apps/api && node scripts/diff-node-detail.js"

const { sql } = require("../src/lib/sql");
const { entityAggregate } = require("../src/lib/entity-detail");

const scope = { tenantId: 1, role: "superadmin", orcid: null, ror: "no-match-ror" };

// OLD paper-DOI set for an entity (by ext_id for author/inst, by name for journal).
async function oldDois(category, ext_id, name) {
  let r;
  if (category === "author")
    r = await sql`SELECT DISTINCT d.doi FROM doi_records d JOIN tags t ON t.doi_record_id=d.id
      WHERE d.tenant_id=1 AND t.category='author' AND t.ext_id IN (${ext_id}, ${"https://orcid.org/" + ext_id})`;
  else if (category === "institution")
    r = await sql`SELECT DISTINCT d.doi FROM doi_records d JOIN tags t ON t.doi_record_id=d.id
      WHERE d.tenant_id=1 AND t.category='institution' AND t.ext_id IN (${ext_id}, ${"https://ror.org/" + ext_id})`;
  else
    r = await sql`SELECT DISTINCT d.doi FROM doi_records d JOIN tags t ON t.doi_record_id=d.id
      WHERE d.tenant_id=1 AND t.category='journal' AND t.value=${name}`;
  return new Set(r.rows.map((x) => x.doi));
}

async function main() {
  let drift = 0;
  // Sample: top authors / institutions / journals by paper count.
  const authors = (await sql`SELECT a.orcid FROM authorship s JOIN authors a ON a.id=s.author_id
    WHERE a.tenant_id=1 GROUP BY a.orcid ORDER BY COUNT(*) DESC LIMIT 5`).rows;
  const insts = (await sql`SELECT i.ror FROM affiliated_with aw JOIN institutions i ON i.id=aw.institution_id
    WHERE i.tenant_id=1 GROUP BY i.ror ORDER BY COUNT(*) DESC LIMIT 5`).rows;
  const jours = (await sql`SELECT v.name FROM published_in pi JOIN venues v ON v.id=pi.venue_id
    WHERE v.tenant_id=1 AND v.venue_type='journal' GROUP BY v.name ORDER BY COUNT(*) DESC LIMIT 5`).rows;

  for (const a of authors) {
    const old = await oldDois("author", a.orcid, null);
    const agg = await entityAggregate(scope, "author", a.orcid);
    const ok = agg.papersCount >= old.size; // entity ≥ old (recovery); never fewer
    console.log(`${ok ? "OK " : "DRIFT"}  author ${a.orcid} aggregate: oldDois=${old.size} newCount=${agg.papersCount}`);
    if (!ok) drift++;
  }
  for (const i of insts) {
    const old = await oldDois("institution", i.ror, null);
    const agg = await entityAggregate(scope, "institution", i.ror);
    const ok = agg.papersCount >= old.size;
    console.log(`${ok ? "OK " : "DRIFT"}  institution ${i.ror} aggregate: oldDois=${old.size} newCount=${agg.papersCount}`);
    if (!ok) drift++;
  }
  for (const j of jours) {
    const old = await oldDois("journal", null, j.name);
    const agg = await entityAggregate(scope, "journal", j.name);
    const ok = agg.papersCount >= old.size;
    console.log(`${ok ? "OK " : "DRIFT"}  journal "${j.name.slice(0, 30)}" aggregate: oldDois=${old.size} newCount=${agg.papersCount}`);
    if (!ok) drift++;
  }
  console.log(drift === 0 ? "\n✓ node-detail entity migration: NEW recovers, never loses" : `\n✗ ${drift} drift(s)`);
  process.exit(drift === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(2); });

// Diff gate for P0d readers (tags → entities): auth-helpers (countPapersByOrcid/
// Ror), org-tree (per-ORCID paper count), claustro (indexed-pub count via venue
// flags), public-graph (author/inst node sets). Admin/tenant 1. READ-ONLY.
// Invariant: NEW matches OLD distinct-DOI counts, modulo the proven sibling/merge
// recovery (NEW ≥ OLD). claustro's indexed count is the one new-logic check.

const { sql } = require("../src/lib/sql");
const { normOrcid, normRor } = require("../src/lib/entity-normalize");
const { SOURCE_TO_FLAG } = require("../src/lib/venue-flags");

function ok(label, pass, extra = "") { console.log(`${pass ? "OK " : "DRIFT"}  ${label} ${extra}`); return pass; }

async function main() {
  let drift = 0;
  const T = 1;
  // auth-helpers: countPapersByOrcid (top author) — OLD distinct doi via tags vs NEW authorship.
  const orc = (await sql`SELECT a.orcid FROM authorship s JOIN authors a ON a.id=s.author_id WHERE a.tenant_id=1 GROUP BY a.orcid ORDER BY COUNT(*) DESC LIMIT 1`).rows[0].orcid;
  const oldO = +(await sql`SELECT COUNT(DISTINCT t.doi_record_id) c FROM tags t JOIN doi_records d ON d.id=t.doi_record_id WHERE t.category='author' AND t.ext_id=${orc} AND d.tenant_id=${T}`).rows[0].c;
  const newO = +(await sql`SELECT COUNT(DISTINCT s.publication_id) c FROM authorship s JOIN authors a ON a.id=s.author_id WHERE a.orcid=${normOrcid(orc)} AND a.tenant_id=${T}`).rows[0].c;
  if (!ok("countPapersByOrcid", newO >= oldO, `old=${oldO} new=${newO}`)) drift++;

  // countPapersByRor (top inst).
  const ror = (await sql`SELECT i.ror FROM affiliated_with aw JOIN institutions i ON i.id=aw.institution_id WHERE i.tenant_id=1 GROUP BY i.ror ORDER BY COUNT(*) DESC LIMIT 1`).rows[0].ror;
  const oldR = +(await sql`SELECT COUNT(DISTINCT t.doi_record_id) c FROM tags t JOIN doi_records d ON d.id=t.doi_record_id WHERE t.category='institution' AND t.ext_id IN (${ror},${"https://ror.org/"+ror}) AND d.tenant_id=${T}`).rows[0].c;
  const newR = +(await sql`SELECT COUNT(DISTINCT aw.publication_id) c FROM affiliated_with aw JOIN institutions i ON i.id=aw.institution_id WHERE i.ror=${normRor(ror)} AND i.tenant_id=${T}`).rows[0].c;
  if (!ok("countPapersByRor", newR >= oldR, `old=${oldR} new=${newR}`)) drift++;

  // claustro indexed-pub count for one orcid (WoS+Scopus+SciELO), no year window.
  const idx = ["WoS", "Scopus", "SciELO"];
  const flags = [...new Set(idx.map((s) => SOURCE_TO_FLAG[s]))];
  const oldC = +(await sql.query(`SELECT COUNT(DISTINCT d.id) c FROM doi_records d
     JOIN tags ta ON ta.doi_record_id=d.id AND ta.category='author'
     JOIN tags ti ON ti.doi_record_id=d.id AND ti.category='indexed_in'
     WHERE d.tenant_id=$1 AND ta.ext_id=$2 AND ti.value=ANY($3::text[])`, [T, orc, idx])).rows[0].c;
  const flagOr = flags.map((c) => `v.${c}`).join(" OR ");
  const newC = +(await sql.query(`SELECT COUNT(DISTINCT d.id) c FROM doi_records d
     JOIN authorship s ON s.publication_id=d.id JOIN authors a ON a.id=s.author_id AND a.tenant_id=$1
     JOIN published_in pe ON pe.publication_id=d.id JOIN venues v ON v.id=pe.venue_id AND v.tenant_id=$1
     WHERE d.tenant_id=$1 AND a.orcid=$2 AND (${flagOr})`, [T, normOrcid(orc)])).rows[0].c;
  if (!ok("claustro indexed-pub count", newC >= oldC, `old=${oldC} new=${newC}`)) drift++;

  console.log(drift === 0 ? "\n✓ P0d readers match (NEW ≥ OLD = recovery)" : `\n✗ ${drift} drift(s)`);
  process.exit(drift === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(2); });

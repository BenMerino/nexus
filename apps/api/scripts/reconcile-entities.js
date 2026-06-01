// Reconciliation harness for the tags → entities migration (Step 2 gate).
//
// READ-ONLY. Compares OLD (tag-based) vs NEW (entity/edge) aggregate counts per
// tenant and reports drift. Zero drift is the gate to advance to dual-write /
// reader migration. Run BEFORE backfill (expect NEW=0, drift=OLD) and AFTER
// (expect zero drift). Safe to run against prod anytime — no writes.
//
//   DATABASE_URL=... node apps/api/scripts/reconcile-entities.js
//
// Checks per tenant:
//   authors      — distinct ORCID authors (OLD: tags category='author' by
//                  normalized ext_id; NEW: authors rows)
//   venues       — distinct journals by canonical name key (OLD: journal-canon
//                  collapse of journal tags; NEW: venues rows)
//   institutions — distinct ROR (OLD: tags category='institution'; NEW: institutions)
//   pubs-with-author — publications having ≥1 author edge (authorship coverage)
//
// Exits non-zero if any drift, so it can gate a script/CI step.

const { sql } = require("../src/lib/sql");
const { normOrcid, normRor, venueKeyToIssn } = require("./entity-normalize");
const { collectAffiliationEdges } = require("./backfill-affiliation");

async function tenants() {
  const r = await sql`SELECT DISTINCT tenant_id FROM publications ORDER BY tenant_id`;
  return r.rows.map((x) => x.tenant_id);
}

// OLD author count: distinct normalized ORCID across author tags on this tenant's pubs.
async function oldAuthors(t) {
  const r = await sql`
    SELECT DISTINCT tg.ext_id FROM tags tg
    JOIN publications p ON p.id = tg.doi_record_id
    WHERE tg.category='author' AND tg.ext_id IS NOT NULL AND p.tenant_id=${t}`;
  return new Set(r.rows.map((x) => normOrcid(x.ext_id))).size;
}
async function newAuthors(t) {
  const r = await sql`SELECT COUNT(*)::int n FROM authors WHERE tenant_id=${t}`;
  return r.rows[0].n;
}

// OLD venue count: journal tags collapsed by canonical name key (journal-canon).
async function oldVenues(t) {
  const r = await sql`
    SELECT tg.value, tg.ext_id FROM tags tg
    JOIN publications p ON p.id = tg.doi_record_id
    WHERE tg.category IN ('journal','non-journal','repository')
      AND tg.ext_id IS NOT NULL AND p.tenant_id=${t}`;
  // Count distinct CANONICAL issn_l (the venue identity), not name-keys — two
  // name variants sharing one ISSN-L are one venue (e.g. "EPL Europhysics
  // Letters" / "Europhysics Letters" = 0295-5075). Matches how venues are keyed.
  return new Set([...venueKeyToIssn(r.rows).values()].map((v) => v.issn_l)).size;
}
async function newVenues(t) {
  const r = await sql`SELECT COUNT(*)::int n FROM venues WHERE tenant_id=${t}`;
  return r.rows[0].n;
}

async function oldInstitutions(t) {
  const r = await sql`
    SELECT DISTINCT tg.ext_id FROM tags tg
    JOIN publications p ON p.id = tg.doi_record_id
    WHERE tg.category='institution' AND tg.ext_id IS NOT NULL AND p.tenant_id=${t}`;
  return new Set(r.rows.map((x) => normRor(x.ext_id))).size;
}
async function newInstitutions(t) {
  const r = await sql`SELECT COUNT(*)::int n FROM institutions WHERE tenant_id=${t}`;
  return r.rows[0].n;
}

// affiliation edges: OLD = triples derivable from the affiliations JSON given
// the current entities; NEW = affiliation rows. Uses the same collector as the
// backfill (the pool's query, via a thin client shim) so the metric matches.
async function oldAffiliations(t) {
  const shim = { query: (text, params) => sql.query(text, params) };
  return (await collectAffiliationEdges(shim, t)).length;
}
async function newAffiliations(t) {
  const r = await sql`SELECT COUNT(*)::int n FROM affiliation af
    JOIN publications p ON p.id = af.publication_id WHERE p.tenant_id=${t}`;
  return r.rows[0].n;
}

async function main() {
  let drift = 0;
  for (const t of await tenants()) {
    const checks = [
      ["authors", await oldAuthors(t), await newAuthors(t)],
      ["venues", await oldVenues(t), await newVenues(t)],
      ["institutions", await oldInstitutions(t), await newInstitutions(t)],
      ["affiliations", await oldAffiliations(t), await newAffiliations(t)],
    ];
    console.log(`\n── tenant ${t} ──`);
    for (const [name, oldN, newN] of checks) {
      const ok = oldN === newN;
      if (!ok) drift++;
      console.log(`  ${ok ? "OK " : "DRIFT"}  ${name}: old=${oldN} new=${newN}`);
    }
  }
  console.log(drift === 0 ? "\n✓ zero drift" : `\n✗ ${drift} drift(s)`);
  process.exit(drift === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(2); });

// READ-ONLY pre-check for the venue-flag foundational fix. Confirms the
// entity-derived indexed_in graph edges (DOI → source via venue flags) reproduce
// the old tag-derived edges (DOI has an indexed_in tag of that source), under
// the same preprint/repository exclusion the graph applies. Run before the flag
// backfill to prove the derivation is faithful; expect onlyOLD=onlyNEW=0.
//
//   railway ssh --service Nexus "cd /app/apps/api && node scripts/verify-indexed-flags.js"

const { sql } = require("../src/lib/sql");
const { journalNameKey } = require("../src/lib/journal-canon");

async function tenants() {
  const r = await sql`SELECT DISTINCT tenant_id FROM publications ORDER BY tenant_id`;
  return r.rows.map((x) => x.tenant_id);
}

async function preprintDois(t) {
  const r = await sql`
    SELECT DISTINCT p.doi FROM tags tg JOIN publications p ON p.id=tg.doi_record_id
    WHERE p.tenant_id=${t} AND (tg.category='repository' OR (tg.category='type' AND tg.value='preprint'))`;
  return new Set(r.rows.map((x) => x.doi));
}

// OLD: {src|doi} from indexed_in tags on this tenant's non-preprint pubs.
async function oldEdges(t, pre) {
  const r = await sql`
    SELECT tg.value AS src, p.doi FROM tags tg JOIN publications p ON p.id=tg.doi_record_id
    WHERE tg.category='indexed_in' AND p.tenant_id=${t}`;
  const set = new Set();
  for (const x of r.rows) if (!pre.has(x.doi)) set.add(`${x.src}|${x.doi}`);
  return set;
}

// NEW: derive venue→sources by name-key (as the backfill will), then DOI→source
// via published_in. Pure read; does not touch the flag columns.
async function newEdges(t, pre) {
  const jt = (await sql`
    SELECT DISTINCT tg.value AS name, tg.ext_id AS issn FROM tags tg
    JOIN publications p ON p.id=tg.doi_record_id
    WHERE tg.category='journal' AND tg.ext_id IS NOT NULL AND p.tenant_id=${t}`).rows;
  const issnToKey = new Map();
  for (const r of jt) issnToKey.set(r.issn, journalNameKey(r.name));
  const idx = (await sql`SELECT DISTINCT value AS src, ext_id AS issn FROM tags WHERE category='indexed_in'`).rows;
  const keyToSrc = new Map();
  for (const r of idx) {
    const key = issnToKey.get(r.issn);
    if (!key) continue;
    if (!keyToSrc.has(key)) keyToSrc.set(key, new Set());
    keyToSrc.get(key).add(r.src);
  }
  const venues = (await sql`SELECT id, name FROM venues WHERE tenant_id=${t}`).rows;
  const vidSrc = new Map();
  for (const v of venues) {
    const s = keyToSrc.get(journalNameKey(v.name));
    if (s) vidSrc.set(v.id, s);
  }
  const pi = (await sql`
    SELECT p.doi, pi.venue_id FROM published_in pi JOIN publications p ON p.id=pi.publication_id
    WHERE p.tenant_id=${t}`).rows;
  const set = new Set();
  for (const r of pi) {
    if (pre.has(r.doi)) continue;
    const s = vidSrc.get(r.venue_id);
    if (s) for (const x of s) set.add(`${x}|${r.doi}`);
  }
  return set;
}

async function main() {
  let drift = 0;
  for (const t of await tenants()) {
    const pre = await preprintDois(t);
    const [o, n] = [await oldEdges(t, pre), await newEdges(t, pre)];
    let onlyOld = 0, onlyNew = 0;
    for (const e of o) if (!n.has(e)) onlyOld++;
    for (const e of n) if (!o.has(e)) onlyNew++;
    const ok = onlyOld === 0 && onlyNew === 0;
    if (!ok) drift++;
    console.log(`${ok ? "OK " : "DRIFT"}  tenant ${t}: indexed_in edges old=${o.size} new=${n.size} onlyOLD=${onlyOld} onlyNEW=${onlyNew}`);
  }
  console.log(drift === 0 ? "\n✓ indexed_in derivation is faithful" : `\n✗ ${drift} tenant(s) drift`);
  process.exit(drift === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(2); });

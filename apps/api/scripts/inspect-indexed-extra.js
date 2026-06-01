// One-off: show the onlyNEW indexed_in edges (DOIs the venue-flag model marks
// indexed but the old per-ISSN tags didn't), with the venue + the paper's own
// journal ISSN, to confirm they are sibling-ISSN coverage of the SAME journal
// (legitimate) vs a name-key collision merging distinct journals (a bug).

const { sql } = require("../src/lib/sql");
const { journalNameKey } = require("../src/lib/journal-canon");

async function main() {
  const T = 1;
  const jt = (await sql`
    SELECT DISTINCT tg.value AS name, tg.ext_id AS issn FROM tags tg
    JOIN publications p ON p.id=tg.doi_record_id
    WHERE tg.category='journal' AND tg.ext_id IS NOT NULL AND p.tenant_id=${T}`).rows;
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
  const venues = (await sql`SELECT id, name FROM venues WHERE tenant_id=${T}`).rows;
  const vidSrc = new Map();
  for (const v of venues) {
    const s = keyToSrc.get(journalNameKey(v.name));
    if (s) vidSrc.set(v.id, s);
  }
  // preprint exclusion
  const pre = new Set((await sql`SELECT DISTINCT p.doi FROM tags tg JOIN publications p ON p.id=tg.doi_record_id
    WHERE p.tenant_id=${T} AND (tg.category='repository' OR (tg.category='type' AND tg.value='preprint'))`).rows.map(x => x.doi));
  // old edges
  const old = new Set();
  for (const x of (await sql`SELECT tg.value AS src, p.doi FROM tags tg JOIN publications p ON p.id=tg.doi_record_id
    WHERE tg.category='indexed_in' AND p.tenant_id=${T}`).rows) if (!pre.has(x.doi)) old.add(`${x.src}|${x.doi}`);
  // new edges with context
  const pi = (await sql`SELECT p.doi, pi.venue_id, v.name AS vname FROM published_in pi
    JOIN publications p ON p.id=pi.publication_id JOIN venues v ON v.id=pi.venue_id
    WHERE p.tenant_id=${T}`).rows;
  // map doi -> its own journal-tag issns
  const doiIssns = new Map();
  for (const r of (await sql`SELECT p.doi, tg.ext_id issn FROM tags tg JOIN publications p ON p.id=tg.doi_record_id
    WHERE tg.category='journal' AND tg.ext_id IS NOT NULL AND p.tenant_id=${T}`).rows) {
    if (!doiIssns.has(r.doi)) doiIssns.set(r.doi, new Set());
    doiIssns.get(r.doi).add(r.issn);
  }
  const extras = [];
  for (const r of pi) {
    if (pre.has(r.doi)) continue;
    const s = vidSrc.get(r.venue_id);
    if (!s) continue;
    for (const src of s) {
      const e = `${src}|${r.doi}`;
      if (!old.has(e)) extras.push({ src, doi: r.doi, venue: r.vname, ownIssns: [...(doiIssns.get(r.doi) || [])].join(",") });
    }
  }
  console.log(`onlyNEW count: ${extras.length}`);
  // group by venue
  const byVenue = {};
  for (const e of extras) byVenue[e.venue] = (byVenue[e.venue] || 0) + 1;
  console.log("by venue:", JSON.stringify(byVenue, null, 2));
  console.log("\nsamples:");
  for (const e of extras.slice(0, 15)) console.log(`  ${e.src}  venue="${e.venue}"  paper-issns=[${e.ownIssns}]  doi=${e.doi}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

// Diff gate for public-authors aggregateAuthors (tags+JSON → entities). Compares
// OLD (author tags filtered by affiliations-JSON ROR) vs NEW (affiliation edge)
// for tenant 1: the author ORCID set + per-author paperCount/totalCitations.
// READ-ONLY. The ROR-filter equivalence (affiliation edge == JSON) is already
// proven (1947=1947); this checks the per-author aggregates line up.
//
//   railway ssh --service Nexus "cd /app/apps/api && node scripts/diff-public-authors.js"

const { sql } = require("../src/lib/sql");
const { normRor } = require("../src/lib/entity-normalize");

function rorTail(r) { return String(r || "").trim().split("/").pop().toLowerCase(); }

// OLD: author-tag rows kept when the author is ROR-affiliated on that paper (JSON).
async function oldByAuthor(tenantId, tenantRor) {
  const tail = rorTail(tenantRor);
  const recs = (await sql`SELECT id, citation_count, affiliations FROM doi_records WHERE tenant_id=${tenantId}`).rows;
  const allow = new Map(); // paperId -> Set(orcid) affiliated at ROR
  const cites = new Map();
  for (const r of recs) {
    cites.set(r.id, parseInt(r.citation_count) || 0);
    const s = new Set();
    try {
      for (const a of JSON.parse(r.affiliations || "[]")) {
        if ((a.affiliations || []).some((x) => rorTail(x.ror) === tail) && a.orcid) s.add(a.orcid);
      }
    } catch {}
    allow.set(r.id, s);
  }
  const tags = (await sql`SELECT t.doi_record_id pid, t.ext_id orcid FROM tags t JOIN doi_records d ON d.id=t.doi_record_id
    WHERE t.category='author' AND t.ext_id IS NOT NULL AND d.tenant_id=${tenantId}`).rows;
  const m = new Map(); // orcid -> {n, cites}
  for (const t of tags) {
    if (!allow.get(t.pid)?.has(t.orcid)) continue;
    if (!m.has(t.orcid)) m.set(t.orcid, { n: 0, c: 0 });
    m.get(t.orcid).n++; m.get(t.orcid).c += cites.get(t.pid);
  }
  return m;
}
// NEW: affiliation edge to the tenant institution.
async function newByAuthor(tenantId, tenantRor) {
  const r = (await sql`SELECT a.orcid, d.citation_count FROM affiliation af
    JOIN institutions i ON i.id=af.institution_id AND i.tenant_id=${tenantId} AND i.ror=${normRor(tenantRor)}
    JOIN authors a ON a.id=af.author_id JOIN doi_records d ON d.id=af.publication_id`).rows;
  const m = new Map();
  for (const x of r) { if (!m.has(x.orcid)) m.set(x.orcid, { n: 0, c: 0 }); m.get(x.orcid).n++; m.get(x.orcid).c += parseInt(x.citation_count) || 0; }
  return m;
}

async function main() {
  const ror = (await sql`SELECT ror_id FROM tenants WHERE id=1`).rows[0].ror_id;
  const [o, n] = [await oldByAuthor(1, ror), await newByAuthor(1, ror)];
  const keys = new Set([...o.keys(), ...n.keys()]);
  let lost = 0, gained = 0, mismatch = 0; const ex = [];
  for (const k of keys) {
    const a = o.get(k), b = n.get(k);
    if (a && !b) lost++;
    else if (b && !a) gained++;
    else if (a.n !== b.n || a.c !== b.c) { mismatch++; if (ex.length < 8) ex.push(`${k}: old(${a.n}p,${a.c}c) new(${b.n}p,${b.c}c)`); }
  }
  console.log(`authors: old=${o.size} new=${n.size} lost=${lost} gained=${gained} count-mismatch=${mismatch}`);
  for (const e of ex) console.log("  " + e);
  const ok = lost === 0 && mismatch === 0;
  console.log(ok ? "\n✓ public-authors entity migration matches (gained = recovery)" : "\n✗ drift");
  process.exit(ok ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(2); });

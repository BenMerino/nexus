const { sql } = require("@vercel/postgres");
const { normalizeIssn } = require("../lib/indexed-journals");

async function main() {
  const r = await sql`
    SELECT doi_record_id, ext_id, value FROM tags
    WHERE category='journal' AND ext_id IS NOT NULL`;
  const byIssn = new Map();
  for (const row of r.rows) {
    const issn = normalizeIssn(row.ext_id);
    if (!issn) continue;
    if (!byIssn.has(issn)) byIssn.set(issn, { name: row.value, records: new Set() });
    byIssn.get(issn).records.add(row.doi_record_id);
  }

  let fetched = 0, inserted = 0, skipped = 0;
  const siblings = new Map();
  for (const [issn, info] of byIssn) {
    try {
      const resp = await fetch(`https://api.openalex.org/sources/issn:${issn}`, {
        headers: { "User-Agent": "Nexus/1.0 (mailto:dev@example.com)" },
      });
      if (!resp.ok) { skipped++; continue; }
      const src = await resp.json();
      const all = (src.issn || []).map(normalizeIssn).filter(Boolean);
      siblings.set(issn, { all, name: src.display_name || info.name });
      fetched++;
    } catch { skipped++; }
  }

  for (const [anchor, { all, name }] of siblings) {
    const records = byIssn.get(anchor).records;
    for (const issn of all) {
      if (issn === anchor) continue;
      for (const rid of records) {
        const exists = await sql`SELECT 1 FROM tags
          WHERE doi_record_id=${rid} AND category='journal' AND ext_id=${issn} LIMIT 1`;
        if (exists.rows.length) continue;
        await sql`INSERT INTO tags (doi_record_id, category, value, ext_id)
          VALUES (${rid}, 'journal', ${name}, ${issn})`;
        inserted++;
      }
    }
  }

  console.log({ anchorIssns: byIssn.size, fetched, skipped, inserted });
}

main().catch(e => { console.error(e); process.exit(1); });

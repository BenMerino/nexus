const { sql } = require("@vercel/postgres");

async function seedIndexedJournalsFromOpenAlex() {
  const r = await sql`SELECT DISTINCT ext_id FROM tags
    WHERE category='journal' AND ext_id IS NOT NULL`;
  const issns = r.rows.map(x => x.ext_id);
  const counts = { DOAJ: 0, SciELO: 0, checked: issns.length, skipped: 0 };
  for (const issn of issns) {
    try {
      const resp = await fetch(`https://api.openalex.org/sources/issn:${issn}`,
        { headers: { "User-Agent": "Nexus/1.0 (mailto:dev@example.com)" } });
      if (!resp.ok) { counts.skipped++; continue; }
      const src = await resp.json();
      const name = src.display_name || null;
      const host = (src.host_organization_name || "").toLowerCase();
      const nameLower = (name || "").toLowerCase();
      if (src.is_in_doaj) { await upsert(issn, "DOAJ", name); counts.DOAJ++; }
      if (nameLower.includes("scielo") || host.includes("scielo")) { await upsert(issn, "SciELO", name); counts.SciELO++; }
    } catch {
      counts.skipped++;
    }
  }
  return counts;
}

async function upsert(issn_l, source, journal_name) {
  await sql`INSERT INTO indexed_journals (issn_l, source, journal_name)
    VALUES (${issn_l}, ${source}, ${journal_name})
    ON CONFLICT (issn_l, source) DO UPDATE SET journal_name = EXCLUDED.journal_name`;
}

module.exports = { seedIndexedJournalsFromOpenAlex };

const { sql } = require("@vercel/postgres");
const { normalizeIssn } = require("../indexed-journals");

const FLAG_TO_SOURCE = [
  { flag: "is_core", source: "WoS" },
  { flag: "is_in_doaj", source: "DOAJ" },
  { flag: "is_in_scielo", source: "SciELO" },
];

async function fetchSource(issn) {
  const resp = await fetch(`https://api.openalex.org/sources/issn:${issn}`, {
    headers: { "User-Agent": "Nexus/1.0 (mailto:dev@example.com)" },
  });
  if (!resp.ok) return null;
  return resp.json();
}

async function seed() {
  const r = await sql`SELECT DISTINCT ext_id FROM tags
    WHERE category='journal' AND ext_id IS NOT NULL`;
  const issns = r.rows.map(x => normalizeIssn(x.ext_id)).filter(Boolean);

  const rows = { WoS: [], DOAJ: [], SciELO: [] };
  let checked = 0, skipped = 0;
  for (const issn of issns) {
    const src = await fetchSource(issn).catch(() => null);
    checked++;
    if (!src) { skipped++; continue; }
    const name = src.display_name || null;
    for (const { flag, source } of FLAG_TO_SOURCE) {
      if (src[flag]) rows[source].push({ issn_l: issn, journal_name: name });
    }
  }

  for (const source of Object.keys(rows)) {
    await sql`DELETE FROM indexed_journals WHERE source = ${source}`;
    for (const e of rows[source]) {
      await sql`INSERT INTO indexed_journals (issn_l, source, journal_name)
        VALUES (${e.issn_l}, ${source}, ${e.journal_name})
        ON CONFLICT (issn_l, source) DO UPDATE SET journal_name = EXCLUDED.journal_name`;
    }
  }

  return {
    count: rows.WoS.length + rows.DOAJ.length + rows.SciELO.length,
    checked, skipped,
    wos: rows.WoS.length, doaj: rows.DOAJ.length, scielo: rows.SciELO.length,
  };
}

module.exports = { seed };

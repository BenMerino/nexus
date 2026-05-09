const { sql } = require("../sql");
const { normalizeIssn } = require("../indexed-journals");

const BASE = "https://articlemeta.scielo.org/api/v1/journal/identifiers/";
const PAGE = 1000;

async function fetchScieloCodes() {
  const codes = new Set();
  let offset = 0, total = Infinity;
  while (offset < total) {
    const resp = await fetch(`${BASE}?offset=${offset}&limit=${PAGE}`, {
      headers: { "User-Agent": "Nexus/1.0 (mailto:dev@example.com)" },
    });
    if (!resp.ok) throw new Error(`SciELO ${resp.status}`);
    const page = await resp.json();
    total = page.meta?.total ?? 0;
    for (const obj of page.objects || []) {
      const issn = normalizeIssn(obj.code);
      if (issn) codes.add(issn);
    }
    offset += PAGE;
  }
  return codes;
}

async function seed() {
  const codes = await fetchScieloCodes();
  const r = await sql`
    SELECT DISTINCT ext_id, MAX(value) AS name FROM tags
    WHERE category='journal' AND ext_id IS NOT NULL
    GROUP BY ext_id`;
  const matches = [];
  for (const row of r.rows) {
    const issn = normalizeIssn(row.ext_id);
    if (issn && codes.has(issn)) matches.push({ issn_l: issn, journal_name: row.name });
  }
  await sql`DELETE FROM indexed_journals WHERE source = 'SciELO'`;
  for (const e of matches) {
    await sql`INSERT INTO indexed_journals (issn_l, source, journal_name)
      VALUES (${e.issn_l}, 'SciELO', ${e.journal_name})
      ON CONFLICT (issn_l, source) DO UPDATE SET journal_name = EXCLUDED.journal_name`;
  }
  return { count: matches.length, scieloTotal: codes.size, scanned: r.rows.length };
}

module.exports = { seed };

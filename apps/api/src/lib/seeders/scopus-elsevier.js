const { sql } = require("../sql");
const { normalizeIssn } = require("../indexed-journals");

const ENDPOINT = "https://api.elsevier.com/content/serial/title/issn/";

async function check(issn, key) {
  const resp = await fetch(`${ENDPOINT}${issn}`, {
    headers: { "X-ELS-APIKey": key, "Accept": "application/json" },
  });
  if (resp.status === 404) return { found: false };
  if (!resp.ok) throw new Error(`Scopus ${resp.status}`);
  const body = await resp.json();
  const entry = body?.["serial-metadata-response"]?.entry?.[0];
  if (!entry) return { found: false };
  return { found: true, title: entry["dc:title"] || null, end: entry.coverageEndYear || null };
}

async function seed() {
  const key = process.env.ELSEVIER_API_KEY;
  if (!key) throw new Error("ELSEVIER_API_KEY is not set");

  const r = await sql`
    SELECT issn_l AS ext_id, name FROM venues
    WHERE venue_type='journal' AND issn_l IS NOT NULL`;

  const hits = [];
  let checked = 0, skipped = 0;
  for (const row of r.rows) {
    const issn = normalizeIssn(row.ext_id);
    if (!issn) { skipped++; continue; }
    try {
      const res = await check(issn, key);
      checked++;
      if (res.found) hits.push({ issn_l: issn, journal_name: res.title || row.name });
    } catch { skipped++; }
  }

  await sql`DELETE FROM indexed_journals WHERE source='Scopus'`;
  for (const e of hits) {
    await sql`INSERT INTO indexed_journals (issn_l, source, journal_name)
      VALUES (${e.issn_l}, 'Scopus', ${e.journal_name})
      ON CONFLICT (issn_l, source) DO UPDATE SET journal_name = EXCLUDED.journal_name`;
  }
  return { count: hits.length, checked, skipped };
}

module.exports = { seed };

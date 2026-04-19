const { sql } = require("@vercel/postgres");
const { canonicalSource, listSourceIds } = require("./indexation-sources");

function normalizeIssn(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/[^0-9Xx]/g, "").toUpperCase();
  if (digits.length !== 8) return null;
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
}

function parseCsvLine(line) {
  const out = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',' || c === ';' || c === '\t') { out.push(cur); cur = ""; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length);
  if (!lines.length) return { header: [], rows: [] };
  const header = parseCsvLine(lines[0]).map(h => h.trim().toLowerCase());
  const rows = lines.slice(1).map(parseCsvLine);
  return { header, rows };
}

function findCol(header, candidates) {
  for (const c of candidates) {
    const i = header.findIndex(h => h.includes(c));
    if (i >= 0) return i;
  }
  return -1;
}

function extractEntries(csvText) {
  const { header, rows } = parseCsv(csvText);
  const issnIdx = findCol(header, ["issn"]);
  const titleIdx = findCol(header, ["title", "journal", "name"]);
  if (issnIdx < 0) return [];
  const seen = new Map();
  for (const row of rows) {
    const rawIssns = (row[issnIdx] || "").split(/[\s,;]+/).filter(Boolean);
    const name = titleIdx >= 0 ? row[titleIdx] : null;
    for (const r of rawIssns) {
      const issn = normalizeIssn(r);
      if (issn && !seen.has(issn)) seen.set(issn, name || null);
    }
  }
  return [...seen].map(([issn_l, journal_name]) => ({ issn_l, journal_name }));
}

async function replaceIndex(source, entries) {
  const canon = canonicalSource(source);
  if (!canon) throw new Error(`Unknown source: ${source}`);
  await sql`DELETE FROM indexed_journals WHERE source = ${canon}`;
  for (const e of entries) {
    await sql`INSERT INTO indexed_journals (issn_l, source, journal_name)
      VALUES (${e.issn_l}, ${canon}, ${e.journal_name})
      ON CONFLICT (issn_l, source) DO UPDATE SET journal_name = EXCLUDED.journal_name`;
  }
  return { source: canon, count: entries.length };
}

async function indexationForIssn(issnL) {
  if (!issnL) return [];
  const r = await sql`SELECT source FROM indexed_journals WHERE issn_l = ${issnL}`;
  return r.rows.map(x => x.source);
}

async function getIndexationMap() {
  const r = await sql`SELECT issn_l, source FROM indexed_journals`;
  const map = new Map();
  for (const row of r.rows) {
    if (!map.has(row.issn_l)) map.set(row.issn_l, []);
    map.get(row.issn_l).push(row.source);
  }
  return map;
}

async function listCounts() {
  const r = await sql`
    SELECT source, COUNT(*)::int AS count, MAX(added_at) AS last_seeded_at
    FROM indexed_journals GROUP BY source`;
  const bySource = new Map(r.rows.map(row => [row.source, row]));
  return listSourceIds().map(id => {
    const row = bySource.get(id);
    return {
      source: id,
      count: row ? row.count : 0,
      last_seeded_at: row ? row.last_seeded_at : null,
    };
  });
}

module.exports = {
  canonicalSource, normalizeIssn, parseCsv, extractEntries,
  replaceIndex, indexationForIssn, getIndexationMap, listCounts,
};

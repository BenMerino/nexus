const { normalizeIssn, replaceIndex } = require("../indexed-journals");

const BASE = "https://articlemeta.scielo.org/api/v1/journal/identifiers/";
const PAGE_SIZE = 1000;

async function fetchPage(offset) {
  const resp = await fetch(`${BASE}?offset=${offset}&limit=${PAGE_SIZE}`, {
    headers: { "User-Agent": "Nexus/1.0 (mailto:dev@example.com)" },
  });
  if (!resp.ok) throw new Error(`SciELO ${resp.status}`);
  return resp.json();
}

async function seed() {
  const entries = new Map();
  let offset = 0, total = Infinity;
  while (offset < total) {
    const page = await fetchPage(offset);
    total = page.meta?.total ?? 0;
    for (const obj of page.objects || []) {
      const issn = normalizeIssn(obj.code);
      if (issn && !entries.has(issn)) entries.set(issn, null);
    }
    offset += PAGE_SIZE;
  }
  const imported = await replaceIndex(
    "SciELO",
    [...entries].map(([issn_l, journal_name]) => ({ issn_l, journal_name })),
  );
  return { count: imported.count };
}

module.exports = { seed };

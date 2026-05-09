const { sql } = require("./sql");
const { calculateHIndex } = require("./h-index");
const { canonicalize } = require("./normalize-tags");

function rorTail(r) {
  if (!r) return null;
  const s = String(r).trim();
  const m = s.match(/([^/]+)$/);
  return (m ? m[1] : s).toLowerCase();
}

function paperAuthorsAtRor(affiliationsJson, tenantRorTail) {
  if (!affiliationsJson || !tenantRorTail) return null;
  try {
    const affs = JSON.parse(affiliationsJson);
    if (!Array.isArray(affs)) return null;
    const names = new Set();
    const orcids = new Set();
    for (const author of affs) {
      const matches = (author.affiliations || []).some(a => rorTail(a.ror) === tenantRorTail);
      if (!matches) continue;
      if (author.name) names.add(author.name);
      if (author.orcid) orcids.add(author.orcid);
    }
    return { names, orcids };
  } catch { return null; }
}

async function getAuthorsDirectory(tenantId, tenantRor) {
  const tail = rorTail(tenantRor);
  const records = await sql`
    SELECT d.id, d.citation_count, d.affiliations, d.type
    FROM doi_records d
    WHERE d.tenant_id = ${tenantId}`;
  const tags = await sql`
    SELECT t.doi_record_id, COALESCE(t.ext_id, t.value) AS author_id,
           t.value AS name, t.ext_id AS orcid
    FROM tags t JOIN doi_records d ON d.id = t.doi_record_id
    WHERE t.category = 'author' AND d.tenant_id = ${tenantId}`;

  const allowedPerPaper = new Map();
  for (const r of records.rows) {
    allowedPerPaper.set(r.id, paperAuthorsAtRor(r.affiliations, tail));
  }
  const paperById = new Map(records.rows.map(r => [r.id, {
    citations: parseInt(r.citation_count) || 0,
    type: r.type ? canonicalize("type", r.type) : null,
  }]));

  const byAuthor = new Map();
  for (const t of tags.rows) {
    const allowed = allowedPerPaper.get(t.doi_record_id);
    if (tail && allowed && !(t.orcid && allowed.orcids.has(t.orcid)) && !(t.name && allowed.names.has(t.name))) continue;
    const key = t.author_id;
    if (!byAuthor.has(key)) byAuthor.set(key, { name: t.name, orcid: t.orcid || null, citations: [], byType: new Map() });
    const p = paperById.get(t.doi_record_id);
    if (!p) continue;
    byAuthor.get(key).citations.push(p.citations);
    if (p.type) {
      if (!byAuthor.get(key).byType.has(p.type)) byAuthor.get(key).byType.set(p.type, []);
      byAuthor.get(key).byType.get(p.type).push(p.citations);
    }
  }

  const out = [];
  for (const [, v] of byAuthor) {
    const hIndexByType = {};
    for (const [type, cites] of v.byType) hIndexByType[type] = calculateHIndex(cites);
    out.push({
      name: v.name,
      orcid: v.orcid,
      paperCount: v.citations.length,
      totalCitations: v.citations.reduce((s, c) => s + c, 0),
      hIndex: calculateHIndex(v.citations),
      hIndexByType,
    });
  }
  out.sort((a, b) => b.paperCount - a.paperCount);
  return out;
}

module.exports = { getAuthorsDirectory };

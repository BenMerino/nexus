const { sql } = require("@vercel/postgres");

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
    const names = new Set(), orcids = new Set();
    for (const a of affs) {
      if ((a.affiliations || []).some(x => rorTail(x.ror) === tenantRorTail)) {
        if (a.name) names.add(a.name);
        if (a.orcid) orcids.add(a.orcid);
      }
    }
    return { names, orcids };
  } catch { return null; }
}

const MAX_AUTHORS = 80;
const MAX_INSTITUTIONS = 40;

async function buildPublicGraph(tenantId, tenantRor) {
  const tail = rorTail(tenantRor);
  const records = await sql`SELECT id, affiliations FROM doi_records WHERE tenant_id = ${tenantId}`;
  const authorTags = await sql`
    SELECT t.doi_record_id, COALESCE(t.ext_id, t.value) AS author_id,
           t.value AS name, t.ext_id AS orcid
    FROM tags t JOIN doi_records d ON d.id = t.doi_record_id
    WHERE t.category = 'author' AND d.tenant_id = ${tenantId}`;
  const instTags = await sql`
    SELECT t.doi_record_id, COALESCE(t.ext_id, t.value) AS inst_id,
           t.value AS name, t.ext_id AS ror
    FROM tags t JOIN doi_records d ON d.id = t.doi_record_id
    WHERE t.category = 'institution' AND d.tenant_id = ${tenantId}`;

  const allowedPerPaper = new Map();
  for (const r of records.rows) allowedPerPaper.set(r.id, paperAuthorsAtRor(r.affiliations, tail));

  const authorPapers = new Map();
  const authorMeta = new Map();
  for (const t of authorTags.rows) {
    const allowed = allowedPerPaper.get(t.doi_record_id);
    if (tail && allowed && !(t.orcid && allowed.orcids.has(t.orcid)) && !(t.name && allowed.names.has(t.name))) continue;
    if (!authorPapers.has(t.author_id)) authorPapers.set(t.author_id, new Set());
    authorPapers.get(t.author_id).add(t.doi_record_id);
    if (!authorMeta.has(t.author_id)) authorMeta.set(t.author_id, { name: t.name, ext_id: t.orcid || null });
  }
  const topAuthors = [...authorPapers.entries()]
    .sort((a, b) => b[1].size - a[1].size).slice(0, MAX_AUTHORS);
  const topAuthorIds = new Set(topAuthors.map(([id]) => id));

  const instPapers = new Map();
  const instMeta = new Map();
  for (const t of instTags.rows) {
    if (rorTail(t.ror) === tail) continue;
    if (!instPapers.has(t.inst_id)) instPapers.set(t.inst_id, new Set());
    instPapers.get(t.inst_id).add(t.doi_record_id);
    if (!instMeta.has(t.inst_id)) instMeta.set(t.inst_id, { name: t.name, ext_id: t.ror || null });
  }
  const topInsts = [...instPapers.entries()]
    .sort((a, b) => b[1].size - a[1].size).slice(0, MAX_INSTITUTIONS);
  const topInstIds = new Set(topInsts.map(([id]) => id));

  const nodes = [];
  for (const [id] of topAuthors) {
    const m = authorMeta.get(id);
    nodes.push({ id: `author:${id}`, label: m.name, group: "author", ext_id: m.ext_id });
  }
  for (const [id] of topInsts) {
    const m = instMeta.get(id);
    nodes.push({ id: `institution:${id}`, label: m.name, group: "institution", ext_id: m.ext_id });
  }

  const edges = [];
  for (const [aId, aPapers] of topAuthors) {
    for (const [iId, iPapers] of topInsts) {
      let shared = 0;
      for (const p of aPapers) if (iPapers.has(p)) shared++;
      if (shared > 0) edges.push({ source: `author:${aId}`, target: `institution:${iId}`, weight: shared });
    }
  }
  return { nodes, edges };
}

module.exports = { buildPublicGraph };

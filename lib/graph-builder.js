const { sql } = require("@vercel/postgres");
const { getAllTags } = require("./db");

async function loadSynonymMap(tenantId) {
  const { rows } = await sql`SELECT category, variant, canonical FROM tag_synonyms WHERE tenant_id = ${tenantId}`;
  const map = new Map();
  for (const r of rows) map.set(`${r.category}:${r.variant}`, r.canonical);
  return map;
}

async function buildGraph(scope) {
  const tags = await getAllTags(scope);
  const synonymMap = await loadSynonymMap(scope.tenantId);
  const nodes = new Map();
  const edges = [];
  const extIdMap = new Map();
  for (const t of tags) {
    const resolved = synonymMap.get(`${t.category}:${t.value}`) || t.value;
    const doiNodeId = `doi:${t.doi}`;
    let tagNodeId;
    if (t.ext_id) {
      tagNodeId = `${t.category}:${t.ext_id}`;
      if (!extIdMap.has(tagNodeId)) extIdMap.set(tagNodeId, resolved);
    } else {
      tagNodeId = `${t.category}:${resolved}`;
    }
    const label = extIdMap.get(tagNodeId) || resolved;
    if (!nodes.has(doiNodeId)) nodes.set(doiNodeId, { id: doiNodeId, label: t.title || t.doi, group: "doi", published: t.published || null });
    if (!nodes.has(tagNodeId)) nodes.set(tagNodeId, { id: tagNodeId, label, group: t.category, ext_id: t.ext_id });
    edges.push({ source: doiNodeId, target: tagNodeId });
  }
  return { nodes: Array.from(nodes.values()), edges };
}

module.exports = { buildGraph };

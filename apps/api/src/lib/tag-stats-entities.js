// Entity-backed replacement for the legacy grouped `tags` view (the bare
// /api/tag-stats response). Consumers (explore-tags tag cloud, author-import
// suggestions) need {category, value, count} per node — exactly the entity
// graph's non-doi nodes with their connected-DOI counts. Built by folding the
// entity graph edges (doi → node) the same way graph-meta does, so the node set
// + counts match what the graph renders. Excludes preprint/repository papers
// (the graph does), which is the intended "real published work" view.

const { buildGraphFromEntities } = require("./graph-builder-entities");

async function getTagStats(scope) {
  if (!scope) throw new Error("getTagStats requires scope");
  const { nodes, edges } = await buildGraphFromEntities(scope);
  const labelById = new Map(nodes.map((n) => [n.id, n]));
  const counts = new Map(); // node id → distinct doi count
  for (const e of edges) {
    const t = labelById.get(e.target);
    if (!t || t.group === "doi") continue;
    counts.set(e.target, (counts.get(e.target) || 0) + 1);
  }
  const out = [];
  for (const [id, count] of counts) {
    const n = labelById.get(id);
    out.push({ category: n.group, value: n.label, ext_id: n.ext_id || null, count });
  }
  out.sort((a, b) => b.count - a.count);
  return out;
}

module.exports = { getTagStats };

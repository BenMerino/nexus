// Shared graph assembly: turns a stream of {category,value,ext_id,doi,title,
// published} rows into {nodes, edges}. Used by BOTH the legacy tag path
// (graph-builder.js) and the entity path (entityGraphRows), so node-ids, dedup,
// label-upgrade and the preprint exclusion are identical by construction.
//
// opts: { synonymMap, journalCanonIssn } — journalCanonIssn is omitted for the
// entity path (venues already collapse ISSN siblings; re-applying would be a
// no-op at best and a divergence risk at worst).

const { journalNameKey } = require("./journal-canon");

function canonicalExtId(category, extId) {
  if (!extId) return null;
  if (category === "institution") return extId.replace(/^https?:\/\/ror\.org\//, "");
  return extId;
}

// Repository-tagged or type=preprint papers are excluded from the explorer.
function preprintDoiSet(rows) {
  const set = new Set();
  for (const t of rows) {
    if (t.category === "repository") set.add(t.doi);
    if (t.category === "type" && t.value === "preprint") set.add(t.doi);
  }
  return set;
}

function assembleGraph(rows, { synonymMap, journalCanonIssn } = {}) {
  const syn = synonymMap || new Map();
  const preprintDois = preprintDoiSet(rows);
  const nodes = new Map();
  const edges = [];
  const extIdMap = new Map();
  const seenEdge = new Set();
  for (const t of rows) {
    if (preprintDois.has(t.doi)) continue;
    const resolved = syn.get(`${t.category}:${t.value}`) || t.value;
    const doiNodeId = `doi:${t.doi}`;
    let extId = canonicalExtId(t.category, t.ext_id);
    // Collapse ISSN siblings to the canonical issn for their journal (tag path
    // only — entity venues are already collapsed, so journalCanonIssn is absent).
    if (journalCanonIssn && t.category === "journal" && resolved) {
      const canon = journalCanonIssn.get(journalNameKey(resolved));
      if (canon) extId = canon;
    }
    let tagNodeId;
    if (extId) {
      tagNodeId = `${t.category}:${extId}`;
      const existing = extIdMap.get(tagNodeId);
      if (!existing && resolved) extIdMap.set(tagNodeId, resolved);
    } else {
      tagNodeId = `${t.category}:${resolved}`;
    }
    const label = extIdMap.get(tagNodeId) || resolved;
    if (!nodes.has(doiNodeId)) nodes.set(doiNodeId, { id: doiNodeId, label: t.title || t.doi, group: "doi", published: t.published || null });
    if (!nodes.has(tagNodeId)) {
      nodes.set(tagNodeId, { id: tagNodeId, label, group: t.category, ext_id: extId });
    } else if (label && !nodes.get(tagNodeId).label) {
      nodes.get(tagNodeId).label = label;
    }
    const edgeKey = `${doiNodeId}→${tagNodeId}`;
    if (!seenEdge.has(edgeKey)) {
      edges.push({ source: doiNodeId, target: tagNodeId });
      seenEdge.add(edgeKey);
    }
  }
  return { nodes, edges };
}

module.exports = { assembleGraph, canonicalExtId };

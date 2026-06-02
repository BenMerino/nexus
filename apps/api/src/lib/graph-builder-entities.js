// Entity-derived graph builder — the SOLE graph path (the legacy tag-based
// graph-builder.js was removed when `tags` was dropped). Row stream comes from
// the entity/edge tables (entityGraphRows); assembly is shared (graph-assemble).
//
// Documented deltas vs the old tag graph (entities are more correct):
//   • 'source' nodes dropped (3 vestigial, no entity table).
//   • indexed_in: per-ISSN nodes → 4 per-source nodes from venues.in_* flags.
//   • institution merges applied in the entity model (no read-time synonym relabel).

const { getAllRecords } = require("./db");
const { assembleGraph, canonicalExtId } = require("./graph-assemble");
const { entityGraphRows } = require("./entity-graph-rows");

// Author→institution affiliation map from the publications.affiliations JSON
// (ORCID + ROR/name), matched to the institution node ids the graph renders.
// The source of truth for community assignment. (Moved here from the removed
// legacy graph-builder.js; no tag dependency.)
function buildAffiliations(records, institutionIdByName, institutionIdByRor) {
  const byAuthor = {};
  for (const r of records) {
    const raw = r.affiliations;
    if (!raw) continue;
    let parsed;
    try { parsed = typeof raw === "string" ? JSON.parse(raw) : raw; }
    catch { continue; }
    if (!Array.isArray(parsed)) continue;
    for (const a of parsed) {
      if (!a?.orcid || !Array.isArray(a.affiliations)) continue;
      const authorId = `author:${a.orcid}`;
      const bucket = byAuthor[authorId] || (byAuthor[authorId] = {});
      const seen = new Set();
      for (const aff of a.affiliations) {
        const affName = typeof aff === "string" ? aff : aff?.name;
        const affRor = typeof aff === "object" ? canonicalExtId("institution", aff?.ror) : null;
        let instId = null;
        if (affRor && institutionIdByRor.has(affRor)) instId = institutionIdByRor.get(affRor);
        else if (affName && institutionIdByName.has(affName.toLowerCase())) instId = institutionIdByName.get(affName.toLowerCase());
        if (!instId || seen.has(instId)) continue;
        seen.add(instId);
        bucket[instId] = (bucket[instId] || 0) + 1;
      }
    }
  }
  return { byAuthor };
}

function affiliationsFromNodes(nodes, records) {
  const institutionIdByRor = new Map();
  const institutionIdByName = new Map();
  for (const n of nodes.values()) {
    if (n.group !== "institution") continue;
    if (n.ext_id) institutionIdByRor.set(n.ext_id, n.id);
    if (n.label) institutionIdByName.set(n.label.toLowerCase(), n.id);
  }
  return buildAffiliations(records, institutionIdByName, institutionIdByRor);
}

async function buildGraphFromEntities(scope) {
  // No synonym map: institution merges are applied in the ENTITY model
  // (mergeInstitutionSynonym), so entity rows already carry canonical names.
  const [rows, records] = await Promise.all([
    entityGraphRows(scope),
    getAllRecords(scope),
  ]);
  const { nodes, edges } = assembleGraph(rows, {});
  const affiliations = affiliationsFromNodes(nodes, records);
  return { nodes: Array.from(nodes.values()), edges, affiliations };
}

module.exports = { buildGraphFromEntities };

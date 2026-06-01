// Entity-derived graph builder. Same {nodes, edges, affiliations} shape and the
// SAME assembly as the legacy tag path (graph-assemble), but the row stream
// comes from the entity/edge tables (entityGraphRows) instead of getAllTags.
//
// Documented deltas vs the tag graph (NOT drift — see HANDOFF-tags-migration.md):
//   • 'source' nodes dropped (3 vestigial, no entity table).
//   • indexed_in: 250 per-ISSN nodes → 4 per-source nodes (WoS/Scopus/DOAJ/SciELO)
//     derived from venues.in_* flags, recovering ~164 sibling-ISSN edges the old
//     per-paper-ISSN tags missed.
// journalCanonIssn is intentionally omitted: venues already collapse siblings.

const { getAllRecords } = require("./db");
const { assembleGraph } = require("./graph-assemble");
const { entityGraphRows } = require("./entity-graph-rows");
const { loadSynonymMap, affiliationsFromNodes } = require("./graph-builder");

async function buildGraphFromEntities(scope) {
  const [rows, records, synonymMap] = await Promise.all([
    entityGraphRows(scope),
    getAllRecords(scope),
    loadSynonymMap(scope.tenantId),
  ]);
  const { nodes, edges } = assembleGraph(rows, { synonymMap });
  const affiliations = affiliationsFromNodes(nodes, records);
  return { nodes: Array.from(nodes.values()), edges, affiliations };
}

module.exports = { buildGraphFromEntities };

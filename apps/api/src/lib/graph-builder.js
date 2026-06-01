const { sql } = require("./sql");
const { getAllTags, getAllRecords } = require("./db");
const { canonicalJournalIssns } = require("./journal-canon");
const { assembleGraph, canonicalExtId } = require("./graph-assemble");

async function loadSynonymMap(tenantId) {
  const { rows } = await sql`SELECT category, variant, canonical FROM tag_synonyms WHERE tenant_id = ${tenantId}`;
  const map = new Map();
  for (const r of rows) map.set(`${r.category}:${r.variant}`, r.canonical);
  return map;
}

/** Build the authoritative author→institution map from doi_records.authors
 *  JSON. Each author (by ORCID) gets a count of how many papers they were
 *  affiliated with each institution (by ROR, or by name when ROR is absent).
 *  We match each affiliation to an existing institution node id so author
 *  counts line up with what the graph actually renders. This is the source
 *  of truth for community assignment — not co-occurrence on tags. */
function buildAffiliations(records, institutionIdByName, institutionIdByRor) {
  const byAuthor = {};
  for (const r of records) {
    // The authors column only carries name strings; the rich per-author
    // data (ORCID + affiliations with ROR) lives on the affiliations column.
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

// Resolve the author→institution affiliation map shared by both graph paths.
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

async function buildGraph(scope) {
  const [tags, records] = await Promise.all([getAllTags(scope), getAllRecords(scope)]);
  const synonymMap = await loadSynonymMap(scope.tenantId);
  const journalCanonIssn = canonicalJournalIssns(tags, synonymMap);
  const { nodes, edges } = assembleGraph(tags, { synonymMap, journalCanonIssn });
  const affiliations = affiliationsFromNodes(nodes, records);
  return { nodes: Array.from(nodes.values()), edges, affiliations };
}

module.exports = { buildGraph, loadSynonymMap, affiliationsFromNodes };

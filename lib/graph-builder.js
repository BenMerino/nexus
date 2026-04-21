const { sql } = require("@vercel/postgres");
const { getAllTags, getAllRecords } = require("./db");

async function loadSynonymMap(tenantId) {
  const { rows } = await sql`SELECT category, variant, canonical FROM tag_synonyms WHERE tenant_id = ${tenantId}`;
  const map = new Map();
  for (const r of rows) map.set(`${r.category}:${r.variant}`, r.canonical);
  return map;
}

function canonicalExtId(category, extId) {
  if (!extId) return null;
  if (category === "institution") return extId.replace(/^https?:\/\/ror\.org\//, "");
  return extId;
}

/** Build the authoritative author→institution map from doi_records.authors
 *  JSON. Each author (by ORCID) gets a count of how many papers they published
 *  while affiliated with each institution (by ROR). This is the source of
 *  truth for community assignment — not co-occurrence on the tags table. */
function buildAffiliations(records) {
  const byAuthor = {};
  for (const r of records) {
    if (!r.authors) continue;
    let parsed;
    try { parsed = typeof r.authors === "string" ? JSON.parse(r.authors) : r.authors; }
    catch { continue; }
    if (!Array.isArray(parsed)) continue;
    for (const a of parsed) {
      if (!a?.orcid || !Array.isArray(a.affiliations)) continue;
      const authorId = `author:${a.orcid}`;
      const bucket = byAuthor[authorId] || (byAuthor[authorId] = {});
      const seen = new Set();
      for (const aff of a.affiliations) {
        if (!aff?.ror) continue;
        const ror = canonicalExtId("institution", aff.ror);
        if (!ror || seen.has(ror)) continue;
        seen.add(ror);
        const instId = `institution:${ror}`;
        bucket[instId] = (bucket[instId] || 0) + 1;
      }
    }
  }
  return { byAuthor };
}

async function buildGraph(scope) {
  const [tags, records] = await Promise.all([getAllTags(scope), getAllRecords(scope)]);
  const synonymMap = await loadSynonymMap(scope.tenantId);
  const nodes = new Map();
  const edges = [];
  const extIdMap = new Map();
  for (const t of tags) {
    const resolved = synonymMap.get(`${t.category}:${t.value}`) || t.value;
    const doiNodeId = `doi:${t.doi}`;
    const extId = canonicalExtId(t.category, t.ext_id);
    let tagNodeId;
    if (extId) {
      tagNodeId = `${t.category}:${extId}`;
      if (!extIdMap.has(tagNodeId)) extIdMap.set(tagNodeId, resolved);
    } else {
      tagNodeId = `${t.category}:${resolved}`;
    }
    const label = extIdMap.get(tagNodeId) || resolved;
    if (!nodes.has(doiNodeId)) nodes.set(doiNodeId, { id: doiNodeId, label: t.title || t.doi, group: "doi", published: t.published || null });
    if (!nodes.has(tagNodeId)) nodes.set(tagNodeId, { id: tagNodeId, label, group: t.category, ext_id: extId });
    edges.push({ source: doiNodeId, target: tagNodeId });
  }
  const affiliations = buildAffiliations(records);
  return { nodes: Array.from(nodes.values()), edges, affiliations };
}

module.exports = { buildGraph };

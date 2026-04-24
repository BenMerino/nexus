const { sql } = require("@vercel/postgres");
const { getAllTags, getAllRecords } = require("./db");
const { journalNameKey, canonicalJournalIssns } = require("./journal-canon");

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

async function buildGraph(scope) {
  const [tags, records] = await Promise.all([getAllTags(scope), getAllRecords(scope)]);
  const synonymMap = await loadSynonymMap(scope.tenantId);
  const journalCanonIssn = canonicalJournalIssns(tags, synonymMap);

  // Preprints / repository-venue papers are excluded from the graph explorer
  // by convention — final published papers only. Collect the DOIs of any
  // record tagged as a repository (SSRN, arXiv, Preprints.org, bioRxiv, …)
  // or whose type is "preprint", and skip their tags below.
  const preprintDois = new Set();
  for (const t of tags) {
    if (t.category === "repository") preprintDois.add(t.doi);
    if (t.category === "type" && t.value === "preprint") preprintDois.add(t.doi);
  }

  const nodes = new Map();
  const edges = [];
  const extIdMap = new Map();
  const seenEdge = new Set();
  for (const t of tags) {
    if (preprintDois.has(t.doi)) continue;
    const resolved = synonymMap.get(`${t.category}:${t.value}`) || t.value;
    const doiNodeId = `doi:${t.doi}`;
    let extId = canonicalExtId(t.category, t.ext_id);
    // Collapse ISSN siblings to the canonical issn for their journal.
    if (t.category === "journal" && resolved) {
      const canon = journalCanonIssn.get(journalNameKey(resolved));
      if (canon) extId = canon;
    }
    let tagNodeId;
    if (extId) {
      tagNodeId = `${t.category}:${extId}`;
      // Prefer the first non-empty label we see for a given extId. A blank
      // earlier row (e.g. missing tags.value) shouldn't stick and block
      // good labels from later rows.
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
      // Node was created earlier with a blank label; upgrade once a name is known.
      nodes.get(tagNodeId).label = label;
    }
    const edgeKey = `${doiNodeId}→${tagNodeId}`;
    if (!seenEdge.has(edgeKey)) {
      edges.push({ source: doiNodeId, target: tagNodeId });
      seenEdge.add(edgeKey);
    }
  }
  const institutionIdByRor = new Map();
  const institutionIdByName = new Map();
  for (const n of nodes.values()) {
    if (n.group !== "institution") continue;
    if (n.ext_id) institutionIdByRor.set(n.ext_id, n.id);
    if (n.label) institutionIdByName.set(n.label.toLowerCase(), n.id);
  }
  const affiliations = buildAffiliations(records, institutionIdByName, institutionIdByRor);
  return { nodes: Array.from(nodes.values()), edges, affiliations };
}

module.exports = { buildGraph };

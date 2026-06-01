// Affiliation-edge backfill (author ↔ institution ↔ publication), Step 2b.
//
// Unlike authors/venues/institutions (derivable from tag rows), the author↔
// institution PAIRING lives only in publications.affiliations JSON:
//   [ { name, orcid, affiliations: [ { name, ror, country, type } ] }, … ]
// So this walks the JSON per publication (idempotent, bulk-batched inserts),
// resolving each (orcid, ror) to entity ids. Run as part of the backfill.

const { normOrcid, normRor } = require('../src/lib/entity-normalize');

// Returns deduped [publication_id, author_id, institution_id] triples for a tenant.
async function collectAffiliationEdges(c, tenantId) {
  const pubs = (await c.query(
    `SELECT id, affiliations FROM publications WHERE affiliations IS NOT NULL AND tenant_id=$1`,
    [tenantId])).rows;
  const authorId = new Map(
    (await c.query(`SELECT id, orcid FROM authors WHERE tenant_id=$1`, [tenantId])).rows
      .map((r) => [r.orcid, r.id]));
  const instId = new Map(
    (await c.query(`SELECT id, ror FROM institutions WHERE tenant_id=$1`, [tenantId])).rows
      .map((r) => [r.ror, r.id]));

  // Variant-ROR → canonical institution id, for institutions merged via
  // synonyms (the variant row is gone, but its edges were re-pointed to the
  // canonical). Lets a JSON aff citing a merged-away ROR resolve correctly so
  // the recompute matches the actual edges.
  const merged = (await c.query(
    `SELECT DISTINCT tg.ext_id AS variant_ror, s.ror_id AS canon_ror
     FROM tag_synonyms s
     JOIN tags tg ON tg.category='institution' AND tg.value=s.variant
     WHERE s.tenant_id=$1 AND s.category='institution' AND s.ror_id IS NOT NULL
       AND tg.ext_id IS NOT NULL`, [tenantId])).rows;
  for (const m of merged) {
    const canonId = instId.get(normRor(m.canon_ror));
    if (canonId && !instId.has(normRor(m.variant_ror))) instId.set(normRor(m.variant_ror), canonId);
  }

  const seen = new Set();
  const edges = [];
  for (const p of pubs) {
    let arr;
    try { arr = typeof p.affiliations === "string" ? JSON.parse(p.affiliations) : p.affiliations; }
    catch { continue; }
    if (!Array.isArray(arr)) continue;
    for (const a of arr) {
      if (!a?.orcid || !Array.isArray(a.affiliations)) continue;
      const aid = authorId.get(normOrcid(a.orcid));
      if (!aid) continue;
      for (const aff of a.affiliations) {
        const ror = aff && typeof aff === "object" ? normRor(aff.ror) : null;
        if (!ror) continue;
        const iid = instId.get(ror);
        if (!iid) continue;
        const key = `${p.id}:${aid}:${iid}`;
        if (seen.has(key)) continue;
        seen.add(key);
        edges.push([p.id, aid, iid]);
      }
    }
  }
  return edges;
}

module.exports = { collectAffiliationEdges };

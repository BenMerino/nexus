const { sql } = require("./sql");
const { normRor } = require("./entity-normalize");

const MAX_AUTHORS = 80;
const MAX_INSTITUTIONS = 40;

// Public collaboration graph (tags → entities). Authors = those affiliated with
// the tenant's institution (the `affiliation` pub↔author↔institution edge, which
// reproduces the old affiliations-JSON ROR filter exactly). Institution nodes =
// every OTHER institution on those authors' papers (`affiliated_with`, excluding
// the tenant's own ROR). Edges = author↔institution paper co-occurrence.
async function buildPublicGraph(tenantId, tenantRor) {
  const ror = tenantRor ? normRor(tenantRor) : null;
  // (paper, author) the author is affiliated with the tenant institution on.
  const authorRows = (ror
    ? await sql`SELECT af.publication_id AS doi_record_id, a.orcid AS author_id, a.name, a.orcid
        FROM affiliation af JOIN institutions i ON i.id = af.institution_id AND i.tenant_id = ${tenantId} AND i.ror = ${ror}
        JOIN authors a ON a.id = af.author_id`
    : await sql`SELECT s.publication_id AS doi_record_id, a.orcid AS author_id, a.name, a.orcid
        FROM authorship s JOIN authors a ON a.id = s.author_id AND a.tenant_id = ${tenantId}`).rows;
  // (paper, institution) for all direct pub↔institution edges in the tenant,
  // excluding the tenant's own institution (the home node isn't a collaborator) —
  // the exclusion happens in JS below against `ror`.
  const authorPapers = new Map();
  const authorMeta = new Map();
  for (const t of authorRows) {
    if (!authorPapers.has(t.author_id)) authorPapers.set(t.author_id, new Set());
    authorPapers.get(t.author_id).add(t.doi_record_id);
    if (!authorMeta.has(t.author_id)) authorMeta.set(t.author_id, { name: t.name, ext_id: t.orcid || null });
  }
  const topAuthors = [...authorPapers.entries()]
    .sort((a, b) => b[1].size - a[1].size).slice(0, MAX_AUTHORS);

  const instPapers = new Map();
  const instMeta = new Map();
  const instAll = (await sql`
    SELECT aw.publication_id AS doi_record_id, i.ror AS inst_id, i.name, i.ror
    FROM affiliated_with aw JOIN institutions i ON i.id = aw.institution_id
    WHERE i.tenant_id = ${tenantId}`).rows;
  for (const t of instAll) {
    if (ror && normRor(t.ror) === ror) continue;
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

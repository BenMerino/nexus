const { sql } = require("./sql");
const { isPersonalScope } = require("./scope");
const { normOrcid } = require("./entity-normalize");
const { buildGraphFromEntities } = require("./graph-builder-entities");

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'by', 'from', 'is', 'was', 'are', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'shall',
  'not', 'no', 'this', 'that', 'these', 'those', 'it', 'its', 'we', 'our', 'they', 'their',
  'as', 'if', 'than', 'so', 'such', 'both', 'each', 'all', 'any', 'more', 'most', 'other',
  'into', 'through', 'during', 'before', 'after', 'between', 'about', 'which', 'who', 'what',
  'also', 'however', 'using', 'based', 'two', 'one', 'new', 'results', 'study', 'method',
]);

function extractKeywords(text, topN = 3) {
  if (!text) return [];
  const words = text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(w => w.length > 3);
  const freq = {};
  for (const w of words) {
    if (!STOPWORDS.has(w)) freq[w] = (freq[w] || 0) + 1;
  }
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, topN).map(([w]) => w);
}

async function getGraphMetadata(scope) {
  if (!scope) throw new Error("getGraphMetadata requires scope");
  // Per-graph-node metadata (avg/max citations, OA%, top abstract keywords),
  // entity-derived. Keyed by the SAME node-ids the entity graph produces — we
  // fold each node's connected DOIs (graph edges: doi:X → nodeId) up into the
  // aggregate, so metadata always lines up with the rendered nodes.
  const { edges } = await buildGraphFromEntities(scope);

  // doi → {citations, openAccess, abstract} for the scope's publications.
  const where = isPersonalScope(scope)
    ? { w: `id IN (SELECT s.publication_id FROM authorship s JOIN authors a ON a.id=s.author_id WHERE a.orcid=$1 AND a.tenant_id=$2)`, p: [normOrcid(scope.orcid), scope.tenantId] }
    : { w: `tenant_id = $1`, p: [scope.tenantId] };
  const docs = (await sql.query(
    `SELECT doi, COALESCE(citation_count,0) AS c, open_access AS oa, abstract FROM doi_records WHERE ${where.w}`, where.p)).rows;
  const byDoi = new Map(docs.map((d) => [`doi:${d.doi}`, d]));

  // Fold edges (doi → node) into per-node accumulators.
  const acc = new Map(); // tag_id → { sum, n, max, oa, abstracts[] }
  for (const e of edges) {
    const d = byDoi.get(e.source);
    if (!d) continue;
    let a = acc.get(e.target);
    if (!a) { a = { sum: 0, n: 0, max: 0, oa: 0, abstracts: [] }; acc.set(e.target, a); }
    a.sum += d.c; a.n += 1; a.max = Math.max(a.max, d.c);
    if (d.oa) a.oa += 1;
    if (d.abstract) a.abstracts.push(d.abstract);
  }

  const tagMeta = {};
  for (const [tagId, a] of acc) {
    tagMeta[tagId] = {
      avgCitations: a.n ? Math.round((a.sum / a.n) * 10) / 10 : 0,
      maxCitations: a.max,
      openAccessPct: a.n ? Math.round((a.oa / a.n) * 100) / 100 : 0,
      topKeywords: extractKeywords(a.abstracts.join(' ')),
    };
  }
  return { tagMeta };
}

module.exports = { getGraphMetadata };

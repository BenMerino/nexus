const { sql } = require("./sql");
const { calculateHIndex } = require("./h-index");
const { canonicalize } = require("./normalize-tags");
const { normRor } = require("./entity-normalize");

// Aggregate every tenant author into the directory shape. Pure compute —
// no pagination, no search. Returned in paperCount-desc order.
//
// Entity-backed (tags → entities): an author "belongs" to the tenant directory
// for the papers where they're affiliated with the tenant's institution — the
// `affiliation` edge (pub↔author↔institution), which exactly reproduces the old
// affiliations-JSON ROR filter (verified 1947=1947). When the tenant has no ROR,
// fall back to all the tenant's authorship papers.
async function aggregateAuthors(tenantId, tenantRor) {
  const ror = tenantRor ? normRor(tenantRor) : null;
  const rows = ror
    ? (await sql`
        SELECT a.orcid, a.name, d.citation_count, d.type
        FROM affiliation af
        JOIN institutions i ON i.id = af.institution_id AND i.tenant_id = ${tenantId} AND i.ror = ${ror}
        JOIN authors a ON a.id = af.author_id
        JOIN doi_records d ON d.id = af.publication_id`).rows
    : (await sql`
        SELECT a.orcid, a.name, d.citation_count, d.type
        FROM authorship s JOIN authors a ON a.id = s.author_id AND a.tenant_id = ${tenantId}
        JOIN doi_records d ON d.id = s.publication_id`).rows;

  const byAuthor = new Map();
  for (const t of rows) {
    const key = t.orcid; // entity authors are ORCID-keyed
    if (!byAuthor.has(key)) byAuthor.set(key, { name: t.name, orcid: t.orcid || null, citations: [], byType: new Map() });
    const citations = parseInt(t.citation_count) || 0;
    const type = t.type ? canonicalize("type", t.type) : null;
    byAuthor.get(key).citations.push(citations);
    if (type) {
      if (!byAuthor.get(key).byType.has(type)) byAuthor.get(key).byType.set(type, []);
      byAuthor.get(key).byType.get(type).push(citations);
    }
  }

  const out = [];
  for (const [, v] of byAuthor) {
    const hIndexByType = {};
    for (const [type, cites] of v.byType) hIndexByType[type] = calculateHIndex(cites);
    out.push({
      name: v.name,
      orcid: v.orcid,
      paperCount: v.citations.length,
      totalCitations: v.citations.reduce((s, c) => s + c, 0),
      hIndex: calculateHIndex(v.citations),
      hIndexByType,
    });
  }
  out.sort((a, b) => b.paperCount - a.paperCount);
  return out;
}

// Per-request cache so concurrent stats+authors calls don't aggregate twice.
// Keyed on tenantId; cleared when the value is older than CACHE_MS.
const CACHE_MS = 60_000;
const cache = new Map(); // tenantId -> { at, promise }

function cachedAggregate(tenantId, tenantRor) {
  const hit = cache.get(tenantId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.promise;
  const promise = aggregateAuthors(tenantId, tenantRor);
  cache.set(tenantId, { at: Date.now(), promise });
  return promise;
}

// Sortable fields exposed to clients. The aggregator pre-sorts by paperCount
// desc; non-default sorts re-order the cached array in place per request.
const SORT_FIELDS = {
  name:           (a, b) => a.name.localeCompare(b.name),
  paperCount:     (a, b) => a.paperCount - b.paperCount,
  hIndex:         (a, b) => a.hIndex - b.hIndex,
  totalCitations: (a, b) => a.totalCitations - b.totalCitations,
};

// Paginated + searchable view over the cached aggregate. Speaks the same
// shape as /api/auth?action=roster-list so the table component on the
// public profile can reuse the roster UI verbatim.
async function getAuthorsPage(tenantId, tenantRor, opts) {
  const all = await cachedAggregate(tenantId, tenantRor);
  const needle = (opts.q || "").trim().toLowerCase();
  const filtered = needle
    ? all.filter(a => a.name.toLowerCase().includes(needle))
    : all.slice();
  const cmp = SORT_FIELDS[opts.sort] || SORT_FIELDS.paperCount;
  const dir = opts.dir === "asc" ? 1 : -1;
  filtered.sort((a, b) => cmp(a, b) * dir);
  const page = Math.max(0, opts.page | 0);
  const pageSize = Math.max(1, Math.min(200, opts.pageSize | 0 || 25));
  const start = page * pageSize;
  return {
    rows: filtered.slice(start, start + pageSize),
    page,
    pageSize,
    totalCount: filtered.length,
  };
}

// Cheap summary count of distinct authors at the tenant (post-ROR filter).
// Used by stats.summary.authorCount so /stats stays self-contained.
async function getAuthorCount(tenantId, tenantRor) {
  const all = await cachedAggregate(tenantId, tenantRor);
  return all.length;
}

module.exports = { getAuthorsPage, getAuthorCount };

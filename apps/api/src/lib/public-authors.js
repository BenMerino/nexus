const { sql } = require("./sql");
const { calculateHIndex } = require("./h-index");
const { canonicalize } = require("./normalize-tags");

function rorTail(r) {
  if (!r) return null;
  const s = String(r).trim();
  const m = s.match(/([^/]+)$/);
  return (m ? m[1] : s).toLowerCase();
}

function paperAuthorsAtRor(affiliationsJson, tenantRorTail) {
  if (!affiliationsJson || !tenantRorTail) return null;
  try {
    const affs = JSON.parse(affiliationsJson);
    if (!Array.isArray(affs)) return null;
    const names = new Set();
    const orcids = new Set();
    for (const author of affs) {
      const matches = (author.affiliations || []).some(a => rorTail(a.ror) === tenantRorTail);
      if (!matches) continue;
      if (author.name) names.add(author.name);
      if (author.orcid) orcids.add(author.orcid);
    }
    return { names, orcids };
  } catch { return null; }
}

// Aggregate every tenant author into the directory shape. Pure compute —
// no pagination, no search. Returned in paperCount-desc order.
async function aggregateAuthors(tenantId, tenantRor) {
  const tail = rorTail(tenantRor);
  const records = await sql`
    SELECT d.id, d.citation_count, d.affiliations, d.type
    FROM doi_records d
    WHERE d.tenant_id = ${tenantId}`;
  const tags = await sql`
    SELECT t.doi_record_id, COALESCE(t.ext_id, t.value) AS author_id,
           t.value AS name, t.ext_id AS orcid
    FROM tags t JOIN doi_records d ON d.id = t.doi_record_id
    WHERE t.category = 'author' AND d.tenant_id = ${tenantId}`;

  const allowedPerPaper = new Map();
  for (const r of records.rows) {
    allowedPerPaper.set(r.id, paperAuthorsAtRor(r.affiliations, tail));
  }
  const paperById = new Map(records.rows.map(r => [r.id, {
    citations: parseInt(r.citation_count) || 0,
    type: r.type ? canonicalize("type", r.type) : null,
  }]));

  const byAuthor = new Map();
  for (const t of tags.rows) {
    const allowed = allowedPerPaper.get(t.doi_record_id);
    if (tail && allowed && !(t.orcid && allowed.orcids.has(t.orcid)) && !(t.name && allowed.names.has(t.name))) continue;
    const key = t.author_id;
    if (!byAuthor.has(key)) byAuthor.set(key, { name: t.name, orcid: t.orcid || null, citations: [], byType: new Map() });
    const p = paperById.get(t.doi_record_id);
    if (!p) continue;
    byAuthor.get(key).citations.push(p.citations);
    if (p.type) {
      if (!byAuthor.get(key).byType.has(p.type)) byAuthor.get(key).byType.set(p.type, []);
      byAuthor.get(key).byType.get(p.type).push(p.citations);
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

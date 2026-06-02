// Entity-backed node-detail primitives (tags → entities). Replaces the tag
// lookups in the LIVE node-detail path (node-detail-resolvers + author-detail).
// (node-detail-helpers.js and institution-detail.js are pre-existing dead code —
// only node-detail-resolvers is imported by handlers/node-detail.js — so they're
// left untouched rather than migrated.)
//
// A detail node is identified by its REAL key: author→ORCID, institution→ROR,
// journal→name_key (ISSN siblings collapse to one venue). These build the
// publication-id set for that entity, narrowed to the caller's scope (personal =
// the user's own papers via authorship), then read papers / aggregates / label.
// No name-only branch — every author/institution tag carries an ext_id.

const { sql } = require("./sql");
const { isPersonalScope } = require("./scope");
const { normOrcid, normRor } = require("./entity-normalize");
const { journalNameKey } = require("./journal-canon");

// Publication-id IN (...) fragment for an entity, params starting at $1.
// Returns { sql, params }; caller appends scope/extra params after.
function entityPubFilter(category, key) {
  if (category === "author")
    return { sql: `id IN (SELECT s.publication_id FROM authorship s JOIN authors a ON a.id=s.author_id WHERE a.orcid=$1 AND a.tenant_id=$2)`, params: [normOrcid(key)] };
  if (category === "institution")
    return { sql: `id IN (SELECT aw.publication_id FROM affiliated_with aw JOIN institutions i ON i.id=aw.institution_id WHERE i.ror=$1 AND i.tenant_id=$2)`, params: [normRor(key)] };
  // journal: key is the journal NAME; resolve by name_key (collapses ISSN siblings).
  return { sql: `id IN (SELECT pi.publication_id FROM published_in pi JOIN venues v ON v.id=pi.venue_id WHERE v.name_key=$1 AND v.tenant_id=$2 AND v.venue_type='journal')`, params: [journalNameKey(key)] };
}

// Personal-scope extra clause: AND the user's own papers (authorship by ORCID).
function personalClause(scope, startIdx) {
  return {
    sql: ` AND id IN (SELECT s.publication_id FROM authorship s JOIN authors a ON a.id=s.author_id WHERE a.orcid=$${startIdx} AND a.tenant_id=$${startIdx + 1})`,
    params: [normOrcid(scope.orcid), scope.tenantId],
  };
}

// Build the full WHERE (entity filter + tenant + optional personal narrowing).
function buildWhere(scope, category, key) {
  const f = entityPubFilter(category, key);
  const params = [...f.params, scope.tenantId]; // $1=entity key, $2=tenantId
  let where = f.sql;
  if (isPersonalScope(scope)) {
    const pc = personalClause(scope, params.length + 1);
    where += pc.sql;
    params.push(...pc.params);
  }
  return { where, params };
}

async function papersByEntity(scope, category, key) {
  const { where, params } = buildWhere(scope, category, key);
  const r = await sql.query(
    `SELECT doi, title, published, citation_count, journal FROM doi_records
     WHERE ${where} ORDER BY published DESC NULLS LAST LIMIT 12`, params);
  return r.rows;
}

// Uncapped paper list (author-detail groups every paper by journal).
async function entityPapersAll(scope, category, key) {
  const { where, params } = buildWhere(scope, category, key);
  const r = await sql.query(
    `SELECT doi, title, published, citation_count, journal FROM doi_records
     WHERE ${where} ORDER BY published DESC NULLS LAST`, params);
  return r.rows;
}

// Citation counts (desc) for h-index — the full population, list uncapped.
async function entityCitationCounts(scope, category, key) {
  const { where, params } = buildWhere(scope, category, key);
  const r = await sql.query(`SELECT citation_count FROM doi_records WHERE ${where}`, params);
  return r.rows.map((x) => x.citation_count || 0).sort((a, b) => b - a);
}

async function entityAggregate(scope, category, key) {
  const { where, params } = buildWhere(scope, category, key);
  const r = await sql.query(
    `SELECT COUNT(*)::int papers_count, COALESCE(SUM(citation_count),0)::int citations,
       COUNT(DISTINCT journal) FILTER (WHERE journal IS NOT NULL AND journal <> '')::int journals_count
     FROM doi_records WHERE ${where}`, params);
  const row = r.rows[0] || {};
  return { papersCount: row.papers_count || 0, citations: row.citations || 0, journalsCount: row.journals_count || 0 };
}

// Canonical label for an entity node, by key. journal key is a name → name_key.
async function entityLabel(category, key, tenantId) {
  if (!key) return null;
  if (category === "author") {
    const r = await sql`SELECT name FROM authors WHERE orcid=${normOrcid(key)} AND tenant_id=${tenantId} LIMIT 1`;
    return r.rows[0]?.name || null;
  }
  if (category === "institution") {
    const r = await sql`SELECT name FROM institutions WHERE ror=${normRor(key)} AND tenant_id=${tenantId} LIMIT 1`;
    return r.rows[0]?.name || null;
  }
  const r = await sql`SELECT name FROM venues WHERE name_key=${journalNameKey(key)} AND tenant_id=${tenantId} LIMIT 1`;
  return r.rows[0]?.name || null;
}

module.exports = { papersByEntity, entityPapersAll, entityCitationCounts, entityAggregate, entityLabel };

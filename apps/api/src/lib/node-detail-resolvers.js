const { sql } = require("./sql");
const { isPersonalScope } = require("./scope");
const { papersByTag, tagLabel, extIdVariants } = require("./node-detail-helpers");
const { authorDetail } = require("./author-detail");
const { getSummary } = require("./dashboard-stats");

function normalizeRor(ror) {
  if (!ror) return null;
  return ror.replace(/^https?:\/\/ror\.org\//, "");
}

async function tagAggregate(scope, category, ext_id, value) {
  // Single aggregate query: count papers, sum citations, count distinct
  // journals. Keeps the view's stats correct over the full population
  // without loading every paper row.
  const personal = isPersonalScope(scope);
  const r = ext_id
    ? (personal
        ? await sql`SELECT COUNT(*)::int AS papers_count,
            COALESCE(SUM(d.citation_count), 0)::int AS citations,
            COUNT(DISTINCT d.journal) FILTER (WHERE d.journal IS NOT NULL AND d.journal <> '')::int AS journals_count
            FROM doi_records d
            WHERE d.id IN (SELECT doi_record_id FROM tags WHERE category=${category} AND ext_id = ANY(${extIdVariants(category, ext_id)}))
              AND d.id IN (SELECT doi_record_id FROM tags WHERE category='author' AND ext_id=${scope.orcid})`
        : await sql`SELECT COUNT(*)::int AS papers_count,
            COALESCE(SUM(d.citation_count), 0)::int AS citations,
            COUNT(DISTINCT d.journal) FILTER (WHERE d.journal IS NOT NULL AND d.journal <> '')::int AS journals_count
            FROM doi_records d
            WHERE d.id IN (SELECT doi_record_id FROM tags WHERE category=${category} AND ext_id = ANY(${extIdVariants(category, ext_id)}))
              AND d.tenant_id = ${scope.tenantId}`)
    : (personal
        ? await sql`SELECT COUNT(*)::int AS papers_count,
            COALESCE(SUM(d.citation_count), 0)::int AS citations,
            COUNT(DISTINCT d.journal) FILTER (WHERE d.journal IS NOT NULL AND d.journal <> '')::int AS journals_count
            FROM doi_records d
            WHERE d.id IN (SELECT doi_record_id FROM tags WHERE category=${category} AND value=${value})
              AND d.id IN (SELECT doi_record_id FROM tags WHERE category='author' AND ext_id=${scope.orcid})`
        : await sql`SELECT COUNT(*)::int AS papers_count,
            COALESCE(SUM(d.citation_count), 0)::int AS citations,
            COUNT(DISTINCT d.journal) FILTER (WHERE d.journal IS NOT NULL AND d.journal <> '')::int AS journals_count
            FROM doi_records d
            WHERE d.id IN (SELECT doi_record_id FROM tags WHERE category=${category} AND value=${value})
              AND d.tenant_id = ${scope.tenantId}`);
  const row = r.rows[0] || {};
  return { papersCount: row.papers_count || 0, citations: row.citations || 0, journalsCount: row.journals_count || 0 };
}

async function homeInstitutionDetail(scope, ext_id, label) {
  // This institution IS the tenant's own institution — use the same pipeline
  // the tenant landing page uses so the numbers always match.
  const [summary, papers, journalsRow] = await Promise.all([
    getSummary(scope),
    sql`SELECT doi, title, published, citation_count, journal FROM doi_records
        WHERE tenant_id=${scope.tenantId}
        ORDER BY published DESC NULLS LAST LIMIT 12`,
    sql`SELECT COUNT(DISTINCT journal)::int AS journals_count
        FROM doi_records WHERE tenant_id=${scope.tenantId}
          AND journal IS NOT NULL AND journal <> ''`,
  ]);
  const name = (await tagLabel("institution", ext_id)) || label;
  return {
    type: "institution", name, ror: ext_id,
    papersCount: summary.totalPubs, citations: summary.totalCitations,
    journalsCount: journalsRow.rows[0]?.journals_count || 0,
    papers: papers.rows,
  };
}

async function institutionDetail(scope, ext_id, label) {
  if (ext_id && scope.ror && normalizeRor(ext_id) === normalizeRor(scope.ror)) {
    return homeInstitutionDetail(scope, ext_id, label);
  }
  const [{ rows: papers }, stats] = await Promise.all([
    papersByTag(scope, "institution", ext_id, label),
    tagAggregate(scope, "institution", ext_id, label),
  ]);
  const name = (await tagLabel("institution", ext_id)) || label;
  return { type: "institution", name, ror: ext_id, papersCount: stats.papersCount, citations: stats.citations, journalsCount: stats.journalsCount, papers };
}

async function journalDetail(scope, ext_id, label) {
  const name = (await tagLabel("journal", ext_id)) || label;
  // Query by name so ISSN siblings (print + online) all resolve to the same
  // journal — a single canonical node must return all its papers.
  const { rows: papers } = await papersByTag(scope, "journal", null, name);
  return { type: "journal", name, issn: ext_id, papersCount: papers.length, papers };
}

async function paperDetail(scope, doi) {
  const personal = isPersonalScope(scope);
  const r = personal
    ? await sql`SELECT doi, title, published, citation_count, journal, authors FROM doi_records
        WHERE doi=${doi} AND id IN (SELECT doi_record_id FROM tags WHERE category='author' AND ext_id=${scope.orcid}) LIMIT 1`
    : await sql`SELECT doi, title, published, citation_count, journal, authors FROM doi_records
        WHERE doi=${doi} AND tenant_id=${scope.tenantId} LIMIT 1`;
  const p = r.rows[0];
  if (!p) return null;
  let authors = [];
  try { authors = JSON.parse(p.authors || "[]"); } catch {}
  return {
    type: "paper", doi: p.doi, title: p.title, published: p.published,
    citations: p.citation_count, journal: p.journal,
    authors: authors.map(a => typeof a === "string" ? { name: a } : a),
  };
}

module.exports = { authorDetail, institutionDetail, journalDetail, paperDetail };

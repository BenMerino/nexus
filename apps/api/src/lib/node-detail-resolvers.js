const { sql } = require("./sql");
const { isPersonalScope } = require("./scope");
const { normOrcid } = require("./entity-normalize");
const { papersByEntity, entityAggregate, entityLabel } = require("./entity-detail");
const { authorDetail } = require("./author-detail");
const { getSummary } = require("./dashboard-stats");

function normalizeRor(ror) {
  if (!ror) return null;
  return ror.replace(/^https?:\/\/ror\.org\//, "");
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
  const name = (await entityLabel("institution", ext_id, scope.tenantId)) || label;
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
  const [papers, stats] = await Promise.all([
    papersByEntity(scope, "institution", ext_id),
    entityAggregate(scope, "institution", ext_id),
  ]);
  const name = (await entityLabel("institution", ext_id, scope.tenantId)) || label;
  return { type: "institution", name, ror: ext_id, papersCount: stats.papersCount, citations: stats.citations, journalsCount: stats.journalsCount, papers };
}

async function journalDetail(scope, ext_id, label) {
  // The journal node carries its NAME as the label; resolve papers + canonical
  // name by name_key so ISSN siblings collapse to one venue.
  const name = (await entityLabel("journal", label, scope.tenantId)) || label;
  const papers = await papersByEntity(scope, "journal", name);
  return { type: "journal", name, issn: ext_id, papersCount: papers.length, papers };
}

async function paperDetail(scope, doi) {
  const personal = isPersonalScope(scope);
  const r = personal
    ? await sql`SELECT doi, title, published, citation_count, journal, authors FROM doi_records
        WHERE doi=${doi} AND id IN (SELECT s.publication_id FROM authorship s JOIN authors a ON a.id=s.author_id
          WHERE a.orcid=${normOrcid(scope.orcid)} AND a.tenant_id=${scope.tenantId}) LIMIT 1`
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

const { sql } = require("@vercel/postgres");
const { isPersonalScope } = require("./scope");
const { papersByTag, tagLabel } = require("./node-detail-helpers");
const { authorDetail } = require("./author-detail");

async function institutionDetail(scope, ext_id, label) {
  const { rows: papers } = await papersByTag(scope, "institution", ext_id, label);
  const name = (await tagLabel("institution", ext_id)) || label;
  return { type: "institution", name, ror: ext_id, papersCount: papers.length, papers };
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

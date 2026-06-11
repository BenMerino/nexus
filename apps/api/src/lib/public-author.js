const { sql } = require("./sql");
const { calculateHIndex } = require("./h-index");
const { canonicalize } = require("./normalize-tags");
const { normRor, normOrcid } = require("./entity-normalize");
const { classifyUnit, unitKeyForNode } = require("./org-units");

// One academic's public profile: identity, roster placement, metrics, papers.
// Same population rule as public-authors.js aggregateAuthors (affiliation edge
// when the tenant has a ROR, authorship fallback otherwise), narrowed to one
// ORCID — so the profile's counts always match the directory row that linked
// to it.
async function queryAuthorPapers(tenantId, ror, orcid) {
  return ror
    ? (await sql`
        SELECT a.name, d.title, d.doi, d.published, d.journal, d.type, d.citation_count
        FROM affiliation af
        JOIN institutions i ON i.id = af.institution_id AND i.tenant_id = ${tenantId} AND i.ror = ${ror}
        JOIN authors a ON a.id = af.author_id AND a.orcid = ${orcid}
        JOIN doi_records d ON d.id = af.publication_id`).rows
    : (await sql`
        SELECT a.name, d.title, d.doi, d.published, d.journal, d.type, d.citation_count
        FROM authorship s
        JOIN authors a ON a.id = s.author_id AND a.tenant_id = ${tenantId} AND a.orcid = ${orcid}
        JOIN doi_records d ON d.id = s.publication_id`).rows;
}

// Roster placement (faculty / department / category + unitKey) from the users
// table. Roster ORCIDs may carry the https://orcid.org/ prefix (CSV import),
// so compare normalized in JS — the roster is small.
async function rosterEntry(tenantId, orcid) {
  const { rows } = await sql`
    SELECT full_name, faculty, department, profile_category, orcid
    FROM users
    WHERE tenant_id = ${tenantId} AND role = 'academic' AND orcid IS NOT NULL`;
  const hit = rows.find((r) => normOrcid(r.orcid) === orcid);
  if (!hit) return null;
  const c = classifyUnit(hit.faculty);
  // Mirror org-tree.js: "other" units' node IS the program/direccion; a person
  // filed at faculty level has no department literal.
  const department = c.kind === "other"
    ? (c.sub || null)
    : (hit.department && hit.department !== hit.faculty ? hit.department : null);
  const unitKey = department
    ? unitKeyForNode(c.kind, c.group, department)
    : (c.kind === "other" ? null : unitKeyForNode(c.kind, c.group, null));
  return { faculty: c.group, department, category: hit.profile_category, unitKey };
}

async function getAuthorProfile(tenantId, tenantRor, rawOrcid) {
  const orcid = normOrcid(rawOrcid);
  if (!orcid) return null;
  const ror = tenantRor ? normRor(tenantRor) : null;
  const rows = await queryAuthorPapers(tenantId, ror, orcid);
  if (!rows.length) return null;

  // Dedupe (duplicate authorship/affiliation edges can't double-count a paper).
  const seen = new Map();
  for (const r of rows) {
    const key = r.doi || `${r.title}|${r.published}`;
    if (!seen.has(key)) seen.set(key, r);
  }
  const papers = [...seen.values()]
    .map((r) => ({
      title: r.title || null,
      doi: r.doi || null,
      year: r.published ? String(r.published).slice(0, 4) : null,
      journal: r.journal || null,
      type: r.type ? canonicalize("type", r.type) : null,
      citations: parseInt(r.citation_count) || 0,
    }))
    .sort((a, b) => (b.year || "").localeCompare(a.year || "") || b.citations - a.citations);

  const byType = {};
  for (const p of papers) if (p.type) (byType[p.type] ||= []).push(p.citations);
  const hIndexByType = {};
  for (const [type, cites] of Object.entries(byType)) hIndexByType[type] = calculateHIndex(cites);

  const roster = await rosterEntry(tenantId, orcid);
  return {
    name: rows[0].name,
    orcid,
    roster,
    paperCount: papers.length,
    totalCitations: papers.reduce((s, p) => s + p.citations, 0),
    hIndex: calculateHIndex(papers.map((p) => p.citations)),
    hIndexByType,
    papers,
  };
}

module.exports = { getAuthorProfile };

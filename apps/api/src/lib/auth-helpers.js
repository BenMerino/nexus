const { sql } = require("./sql");
const { getAuthorHIndexes } = require("./h-index");
const { normOrcid, normRor } = require("./entity-normalize");

function buildProfile(user, tenant) {
  return {
    name: user.full_name, position: user.position,
    faculty: user.faculty, affiliation: tenant?.name,
    orcid: user.orcid || null, ror: tenant?.ror_id || null,
    titles: user.titles ? JSON.parse(user.titles) : [],
  };
}

async function countPapersByOrcid(orcid, tenantId) {
  if (!orcid) return 0;
  const r = await sql`
    SELECT COUNT(DISTINCT s.publication_id) as count FROM authorship s
    JOIN authors a ON a.id = s.author_id
    WHERE a.orcid = ${normOrcid(orcid)} AND a.tenant_id = ${tenantId}`;
  return parseInt(r.rows[0].count) || 0;
}

async function researcherNameByOrcid(orcid, tenantId) {
  if (!orcid) return null;
  const r = await sql`
    SELECT name FROM authors WHERE orcid = ${normOrcid(orcid)} AND tenant_id = ${tenantId} LIMIT 1`;
  return r.rows[0]?.name || null;
}

async function countPapersByRor(ror, tenantId) {
  if (!ror) return 0;
  const r = await sql`
    SELECT COUNT(DISTINCT aw.publication_id) as count FROM affiliated_with aw
    JOIN institutions i ON i.id = aw.institution_id
    WHERE i.ror = ${normRor(ror)} AND i.tenant_id = ${tenantId}`;
  return parseInt(r.rows[0].count) || 0;
}

function computeHIndex(user, records) {
  if (!user.full_name) return null;
  const authors = getAuthorHIndexes(records);
  const norm = s => s.toLowerCase().replace(/[-]/g, " ").trim();
  const surname = norm(user.full_name).split(" ").pop();
  const firstName = user.full_name.split(" ")[0].toLowerCase();
  const match = authors.find(a =>
    norm(a.author) === norm(user.full_name) ||
    (a.author.toLowerCase().includes(surname) && a.author.toLowerCase().includes(firstName))
  );
  if (!match) return null;
  return { hIndex: match.hIndex, byType: match.hIndexByType || {} };
}

module.exports = { buildProfile, computeHIndex, countPapersByOrcid, countPapersByRor, researcherNameByOrcid };

const { sql } = require("@vercel/postgres");
const { getAuthorHIndexes } = require("./h-index");

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
    SELECT COUNT(DISTINCT t.doi_record_id) as count FROM tags t
    JOIN doi_records d ON d.id = t.doi_record_id
    WHERE t.category = 'author' AND t.ext_id = ${orcid} AND d.tenant_id = ${tenantId}`;
  return parseInt(r.rows[0].count) || 0;
}

async function researcherNameByOrcid(orcid, tenantId) {
  if (!orcid) return null;
  const r = await sql`
    SELECT t.value, COUNT(*) AS n FROM tags t
    JOIN doi_records d ON d.id = t.doi_record_id
    WHERE t.category = 'author' AND t.ext_id = ${orcid} AND d.tenant_id = ${tenantId}
    GROUP BY t.value ORDER BY n DESC LIMIT 1`;
  return r.rows[0]?.value || null;
}

async function countPapersByRor(ror, tenantId) {
  if (!ror) return 0;
  const r = await sql`
    SELECT COUNT(DISTINCT t.doi_record_id) as count FROM tags t
    JOIN doi_records d ON d.id = t.doi_record_id
    WHERE t.category = 'institution' AND t.ext_id = ${ror} AND d.tenant_id = ${tenantId}`;
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

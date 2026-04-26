const { sql } = require("@vercel/postgres");
const { requireRole } = require("../lib/auth");
const { ensureSchema, getAllRecords } = require("../lib/db");
const { requireScope, isPersonalScope } = require("../lib/scope");
const { getSummary, getByYearAndSource, getCollaborations, getCountries, getTopJournals, getRecentPapers } = require("../lib/dashboard-stats");
const { fetchInstitutionWorks, fetchInstitutionInfo } = require("../lib/fetchers-institution");
const { importWorksBatch } = require("../lib/store-openalex");
const { getResearcherPortfolio } = require("../lib/portfolio");
const { buildProfile, computeHIndex, researcherNameByOrcid } = require("../lib/auth-helpers");
const { listTenants } = require("../lib/db-users");

async function resolveTargetUser(scope, viewOrcid) {
  if (!viewOrcid) return null;
  const r = await sql`SELECT id, username, full_name, email, role, tenant_id, position, faculty, titles, orcid
    FROM users
    WHERE tenant_id = ${scope.tenantId} AND active = TRUE AND orcid = ${viewOrcid}
    LIMIT 1`;
  return r.rows[0] || null;
}

async function buildViewedUser(targetUser, scope) {
  const tenants = await listTenants();
  const tenant = tenants.find(t => t.id === targetUser.tenant_id);
  const profile = buildProfile(targetUser, tenant);
  const [researcherName, allRecords] = await Promise.all([
    researcherNameByOrcid(targetUser.orcid, scope.tenantId),
    getAllRecords({ ...scope, orcid: targetUser.orcid, role: "user" }),
  ]);
  if (researcherName) profile.researcherName = researcherName;
  const h = targetUser.full_name ? computeHIndex(targetUser, allRecords) : null;
  return {
    user: targetUser.username,
    profile,
    hIndex: h?.hIndex ?? null,
    hIndexByType: h?.byType ?? null,
  };
}

module.exports = async function handler(req, res) {
  await ensureSchema();
  const scope = await requireScope(req, res);
  if (!scope) return;
  const action = req.query.action || "stats";

  if (action === "stats") {
    const targetUser = await resolveTargetUser(scope, req.query.orcid);
    if (req.query.orcid && !targetUser) {
      return res.status(404).json({ error: "Researcher not found in your tenant" });
    }
    const targetOrcid = targetUser?.orcid || null;
    const personalOrcid = targetOrcid || (isPersonalScope(scope) ? scope.orcid : null);
    const effectiveScope = targetOrcid
      ? { ...scope, orcid: targetOrcid, role: "user" }
      : scope;
    const [totals, yearSource, collabs, countries, topJournals, recentPapers] = await Promise.all([
      getSummary(effectiveScope), getByYearAndSource(effectiveScope), getCollaborations(effectiveScope),
      getCountries(effectiveScope), getTopJournals(effectiveScope), getRecentPapers(effectiveScope),
    ]);
    const base = { ...totals, yearSource, collabs, countries, topJournals, recentPapers };
    if (personalOrcid) {
      const [portfolio, viewedUser] = await Promise.all([
        getResearcherPortfolio(personalOrcid, scope.tenantId),
        targetUser ? buildViewedUser(targetUser, scope) : Promise.resolve(null),
      ]);
      return res.json({ ...base, portfolio, viewedUser });
    }
    return res.json(base);
  }

  if (action === "institution-info") {
    const rorId = req.query.ror;
    if (!rorId) return res.status(400).json({ error: "ror is required" });
    const info = await fetchInstitutionInfo(rorId);
    return res.json(info || { error: "Institution not found" });
  }

  if (action === "import") {
    const sa = await requireRole(req, "superadmin");
    if (!sa) return res.status(403).json({ error: "Superadmin required" });
    const rorId = req.query.ror;
    const cursor = req.query.cursor || "*";
    if (!rorId) return res.status(400).json({ error: "ror is required" });
    const page = await fetchInstitutionWorks(rorId, cursor);
    const results = await importWorksBatch(page.works, sa.username);
    return res.json({ ...results, nextCursor: page.nextCursor, totalCount: page.totalCount });
  }

  res.status(404).json({ error: "Unknown action" });
};

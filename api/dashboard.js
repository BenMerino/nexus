const { requireRole } = require("../lib/auth");
const { ensureSchema } = require("../lib/db");
const { requireScope } = require("../lib/scope");
const { getSummary, getByYearAndSource, getCollaborations, getCountries } = require("../lib/dashboard-stats");
const { fetchInstitutionWorks, fetchInstitutionInfo } = require("../lib/fetchers-institution");
const { importWorksBatch } = require("../lib/store-openalex");

module.exports = async function handler(req, res) {
  await ensureSchema();
  const scope = await requireScope(req, res);
  if (!scope) return;
  const action = req.query.action || "stats";

  if (action === "stats") {
    const [totals, yearSource, collabs, countries] = await Promise.all([
      getSummary(scope), getByYearAndSource(scope), getCollaborations(scope), getCountries(scope),
    ]);
    return res.json({ ...totals, yearSource, collabs, countries });
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

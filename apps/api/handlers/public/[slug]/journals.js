const { ensureSchema } = require("../../../src/lib/db");
const { getTenantBySlug } = require("../../../src/lib/db-users");
const { listJournals, listJournalAreas } = require("../../../src/lib/db-journals");

// GET /api/public/:slug/journals?page=0&pageSize=24&q=&area=
// The public tenant page's venue list: one row per journal with paper/citation
// rollups + the four indexation flags. Slug-scoped, no auth. Reuses the same
// listJournals query as the authed /api/journals — a public scope (no orcid)
// resolves to the full-tenant branch (isPersonalScope === false). Paginated
// (the tenant can carry 10k+ venues) — the card grid renders one page at a time.
// `areas` (tenant-wide area→count, for the filter bar) rides along only on the
// first unfiltered page — it doesn't change per-page, no reason to repeat it.
module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  await ensureSchema();
  const tenant = await getTenantBySlug(req.query.slug);
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });

  try {
    const scope = { tenantId: tenant.id, orcid: null, ror: tenant.ror_id, role: "public" };
    const reqPage = parseInt(req.query.page, 10) || 0;
    const reqArea = typeof req.query.area === "string" ? req.query.area : "";
    const [page, areas] = await Promise.all([
      listJournals(scope, {
        page: reqPage,
        pageSize: parseInt(req.query.pageSize, 10) || 24,
        q: typeof req.query.q === "string" ? req.query.q : "",
        area: reqArea,
        sort: typeof req.query.sort === "string" ? req.query.sort : "paperCount",
        dir: req.query.dir === "asc" ? "asc" : "desc",
      }),
      reqPage === 0 && !reqArea ? listJournalAreas(scope) : Promise.resolve(null),
    ]);
    res.setHeader("Cache-Control", "public, max-age=120, s-maxage=300, stale-while-revalidate=3600");
    res.json({
      ok: true, journals: page.rows, page: page.page, pageSize: page.pageSize, totalCount: page.totalCount,
      ...(areas ? { areas } : {}),
    });
  } catch (err) {
    console.error("[public/journals]", err);
    res.status(500).json({ error: err.message });
  }
};

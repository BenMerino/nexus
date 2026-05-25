const { ensureSchema } = require("../../../src/lib/db");
const { getTenantBySlug } = require("../../../src/lib/db-users");
const { getAuthorsPage } = require("../../../src/lib/public-authors");

// GET /api/public/:slug/authors?page=0&pageSize=25&sort=paperCount&dir=desc&q=
// Speaks the same contract as /api/auth?action=roster-list so the public
// table on /t/<slug> can reuse the roster table component verbatim:
//   response: { ok, rows, page, pageSize, totalCount }
// Sort fields: name | paperCount | hIndex | totalCitations.
module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  await ensureSchema();
  const tenant = await getTenantBySlug(req.query.slug);
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });

  try {
    const page = await getAuthorsPage(tenant.id, tenant.ror_id, {
      page: parseInt(req.query.page, 10) || 0,
      pageSize: parseInt(req.query.pageSize, 10) || 25,
      sort: typeof req.query.sort === "string" ? req.query.sort : "paperCount",
      dir: req.query.dir === "asc" ? "asc" : "desc",
      q: typeof req.query.q === "string" ? req.query.q : "",
    });
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    res.json({ ok: true, ...page });
  } catch (err) {
    console.error("[public/authors]", err);
    res.status(500).json({ ok: false, error: err.message });
  }
};

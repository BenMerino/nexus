const { ensureSchema } = require("../../../src/lib/db");
const { getTenantBySlug } = require("../../../src/lib/db-users");
const { listJournals } = require("../../../src/lib/db-journals");

// GET /api/public/:slug/journals
// The public tenant page's venue list: one row per journal with paper/citation
// rollups + the four indexation flags. Slug-scoped, no auth. Reuses the same
// listJournals query as the authed /api/journals — a public scope (no orcid)
// resolves to the full-tenant branch (isPersonalScope === false).
module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  await ensureSchema();
  const tenant = await getTenantBySlug(req.query.slug);
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });

  try {
    const scope = { tenantId: tenant.id, orcid: null, ror: tenant.ror_id, role: "public" };
    const journals = await listJournals(scope);
    res.setHeader("Cache-Control", "public, max-age=120, s-maxage=300, stale-while-revalidate=3600");
    res.json({ ok: true, journals });
  } catch (err) {
    console.error("[public/journals]", err);
    res.status(500).json({ error: err.message });
  }
};

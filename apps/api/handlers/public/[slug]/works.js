const { ensureSchema } = require("../../../src/lib/db");
const { getTenantBySlug } = require("../../../src/lib/db-users");
const { getPublicWorks } = require("../../../src/lib/public-works");

// GET /api/public/:slug/works[?unit=unitKey]
// The tenant page's publication lists: most-cited + most-recent papers.
// ?unit= narrows to one org unit (same resolvePubFilter contract as /stats).
module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  await ensureSchema();
  const tenant = await getTenantBySlug(req.query.slug);
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });

  try {
    const unitKey = typeof req.query.unit === "string" ? req.query.unit : null;
    const scope = { tenantId: tenant.id, orcid: null, ror: tenant.ror_id, role: "public", unitKey };
    const works = await getPublicWorks(scope);
    res.setHeader("Cache-Control", "public, max-age=120, s-maxage=300, stale-while-revalidate=3600");
    res.json({ ok: true, ...works });
  } catch (err) {
    console.error("[public/works]", err);
    res.status(500).json({ error: err.message });
  }
};

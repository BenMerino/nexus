const { ensureSchema } = require("../../../src/lib/db");
const { getTenantBySlug } = require("../../../src/lib/db-users");
const { getPublicStats } = require("../../../src/lib/public-stats");

// GET /api/public/:slug/stats
// Returns the tenant chrome (id/name/branding) plus every chart aggregate.
// Independent from /graph and /authors so the SPA can render the summary
// cards and chart strip as soon as this resolves, without waiting on the
// graph or directory.
module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  await ensureSchema();
  const tenant = await getTenantBySlug(req.query.slug);
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });

  try {
    const scope = { tenantId: tenant.id, orcid: null, ror: tenant.ror_id, role: "public" };
    const stats = await getPublicStats(scope);
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
    res.json({
      tenant: {
        id: tenant.id, name: tenant.name, slug: tenant.slug, ror_id: tenant.ror_id,
        logo_url: tenant.logo_url,
        primary_color: tenant.primary_color, secondary_color: tenant.secondary_color,
      },
      stats,
    });
  } catch (err) {
    console.error("[public/stats]", err);
    res.status(500).json({ error: err.message });
  }
};

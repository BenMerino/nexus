const { ensureSchema } = require("../../lib/db");
const { getTenantBySlug } = require("../../lib/db-users");
const { getPublicStats } = require("../../lib/public-stats");
const { getAuthorsDirectory } = require("../../lib/public-authors");
const { buildPublicGraph } = require("../../lib/public-graph");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  await ensureSchema();
  const slug = req.query.slug;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });

  const scope = { tenantId: tenant.id, orcid: null, ror: tenant.ror_id, role: "public" };
  try {
    const [stats, authors, graph] = await Promise.all([
      getPublicStats(scope),
      getAuthorsDirectory(tenant.id, tenant.ror_id),
      buildPublicGraph(tenant.id, tenant.ror_id),
    ]);
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
    res.json({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        ror_id: tenant.ror_id,
        logo_url: tenant.logo_url,
        primary_color: tenant.primary_color,
        secondary_color: tenant.secondary_color,
      },
      stats,
      authors,
      graph,
    });
  } catch (err) {
    console.error("[public]", err);
    res.status(500).json({ error: err.message });
  }
};

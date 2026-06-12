const { ensureSchema } = require("../../../src/lib/db");
const { getTenantBySlug } = require("../../../src/lib/db-users");
const { buildPublicGraph } = require("../../../src/lib/public-graph");

// GET /api/public/:slug/graph
// Collaboration graph for the tenant's public page. Server-capped at the
// top 80 authors + 40 institutions (see public-graph.js), so the payload
// is already bounded — no pagination needed.
module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  await ensureSchema();
  const tenant = await getTenantBySlug(req.query.slug);
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });

  try {
    const graph = await buildPublicGraph(tenant.id, tenant.ror_id);
    res.setHeader("Cache-Control", "public, max-age=120, s-maxage=300, stale-while-revalidate=3600");
    res.json({ graph });
  } catch (err) {
    console.error("[public/graph]", err);
    res.status(500).json({ error: err.message });
  }
};

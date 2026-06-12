const { ensureSchema } = require("../../../src/lib/db");
const { getTenantBySlug } = require("../../../src/lib/db-users");
const { publicSearch } = require("../../../src/lib/public-search");

// GET /api/public/:slug/search?q=…
// Omnibox search over the tenant's public corpus: researchers (directory
// population) + publications by title. Units are matched client-side from
// the cached org-tree summary, so they aren't part of this payload.
module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  await ensureSchema();
  const tenant = await getTenantBySlug(req.query.slug);
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });

  try {
    const results = await publicSearch(tenant.id, tenant.ror_id, req.query.q);
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=60, stale-while-revalidate=300");
    res.json({ ok: true, ...results });
  } catch (err) {
    console.error("[public/search]", err);
    res.status(500).json({ error: err.message });
  }
};

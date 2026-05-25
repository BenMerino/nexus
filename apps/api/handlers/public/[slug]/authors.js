const { ensureSchema } = require("../../../src/lib/db");
const { getTenantBySlug } = require("../../../src/lib/db-users");
const { getAuthorsPage } = require("../../../src/lib/public-authors");
const { parsePage, envelope } = require("../../../src/lib/pagination");

// GET /api/public/:slug/authors?limit=50&offset=0&q=foo
// Paginated + searchable view over the tenant's author directory. Returns
// the standard envelope { data, pagination } so the client knows total
// count and next_offset for load-more / page controls.
//
// Search is server-side, case-insensitive, substring match on name. Sort
// is fixed at paperCount-desc — the underlying aggregate is sorted once
// and cached for 60s per tenant, so paging through is cheap.
module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  await ensureSchema();
  const tenant = await getTenantBySlug(req.query.slug);
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });

  try {
    const { limit, offset } = parsePage(req.query);
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const { data, total } = await getAuthorsPage(tenant.id, tenant.ror_id, { limit, offset, q });
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    res.json(envelope({ data, total, limit, offset }));
  } catch (err) {
    console.error("[public/authors]", err);
    res.status(500).json({ error: err.message });
  }
};

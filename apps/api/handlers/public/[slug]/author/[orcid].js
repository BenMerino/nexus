const { ensureSchema } = require("../../../../src/lib/db");
const { getTenantBySlug } = require("../../../../src/lib/db-users");
const { getAuthorProfile } = require("../../../../src/lib/public-author");

// GET /api/public/:slug/author/:orcid — one academic's public profile:
//   { ok, profile: { name, orcid, roster: {faculty, department, category,
//     unitKey} | null, paperCount, totalCitations, hIndex, hIndexByType,
//     papers: [{title, doi, year, journal, type, citations}] } }
// Auth-free like the rest of /api/public; tenant resolved by slug, author
// filtered through the tenant's own entities (N1: no cross-tenant reach).
module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  await ensureSchema();
  const tenant = await getTenantBySlug(req.query.slug);
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });

  try {
    const profile = await getAuthorProfile(tenant.id, tenant.ror_id, req.query.orcid);
    if (!profile) return res.status(404).json({ ok: false, error: "Author not found" });
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    res.json({ ok: true, profile });
  } catch (err) {
    console.error("[public/author]", err);
    res.status(500).json({ ok: false, error: err.message });
  }
};

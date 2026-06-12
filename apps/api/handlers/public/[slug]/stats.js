const { ensureSchema } = require("../../../src/lib/db");
const { getTenantBySlug } = require("../../../src/lib/db-users");
const { getPublicChrome, getPublicAnalytics, getPublicStats } = require("../../../src/lib/public-stats");

// GET /api/public/:slug/stats
// Three modes so the shell never blocks on heavy analytics:
//   ?chrome=1    → tenant + {summary, yearRange} only (cheap, paints the shell)
//   ?analytics=1 → the heavy chart aggregates only (fetched when charts tab opens)
//   (default)    → full payload (chrome + analytics), kept for back-compat.
// Independent from /graph and /authors so the SPA renders independently.
module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  await ensureSchema();
  const tenant = await getTenantBySlug(req.query.slug);
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });

  try {
    // ?unit=<unitKey> narrows the summary KPIs to one org unit (faculty/dept).
    // Safe by construction: the key only ever matches this tenant's own roster
    // literals (resolvePubFilter), so a forged key matches nothing (N1).
    const unitKey = typeof req.query.unit === "string" ? req.query.unit : null;
    const scope = { tenantId: tenant.id, orcid: null, ror: tenant.ror_id, role: "public", unitKey };
    const stats = req.query.analytics ? await getPublicAnalytics(scope)
      : req.query.chrome ? await getPublicChrome(scope)
      : await getPublicStats(scope);
    res.setHeader("Cache-Control", "public, max-age=120, s-maxage=300, stale-while-revalidate=3600");
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

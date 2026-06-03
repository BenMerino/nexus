const { ensureSchema } = require("../../../src/lib/db");
const { getTenantBySlug } = require("../../../src/lib/db-users");
const { recordBeacon, recentBeaconStats } = require("../../../src/lib/db-perf-beacon");

// Public load-timing beacon for /t/:slug.
//   POST /api/public/:slug/perf  body { navId, phases:[{phase,ms}] }  → records
//   GET  /api/public/:slug/perf                                       → aggregates
// Anonymous (the page is public); tenant resolved by slug server-side so a
// client can't write to another tenant's row. Best-effort: a failure here
// never affects the page — the beacon is fire-and-forget from the client.
module.exports = async function handler(req, res) {
  await ensureSchema();
  const tenant = await getTenantBySlug(req.query.slug);
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });

  try {
    if (req.method === "GET") {
      const stats = await recentBeaconStats(tenant.id);
      return res.json({ tenant: { id: tenant.id, slug: tenant.slug }, stats });
    }
    if (req.method === "POST") {
      const { navId, phases } = req.body || {};
      if (!navId || !Array.isArray(phases)) return res.status(400).json({ error: "navId + phases[] required" });
      const ua = (req.headers["user-agent"] || "").slice(0, 200);
      const n = await recordBeacon(tenant.id, tenant.slug, String(navId), phases, ua);
      return res.json({ recorded: n });
    }
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("[public/perf]", err);
    res.status(500).json({ error: err.message });
  }
};

const { ensureSchema } = require("../src/lib/db");
const { requireRole } = require("../src/lib/auth");
const { sql } = require("../src/lib/sql");
const { listCounts } = require("../src/lib/indexed-journals");
const { runSeed, runOpenAlexSeed } = require("../src/lib/indexation-seed");
const { rebuildVenueFlags } = require("../src/lib/venue-flags-rebuild");

module.exports = async function handler(req, res) {
  await ensureSchema();
  const sa = await requireRole(req, "superadmin");
  if (!sa) return res.status(403).json({ error: "Superadmin required" });

  if (req.method === "GET") {
    return res.json({ counts: await listCounts() });
  }

  if (req.method === "POST" && req.query.action === "seed-openalex") {
    try {
      const result = await runOpenAlexSeed();
      return res.json({ ok: true, ...result });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }

  if (req.method === "POST" && req.query.action === "reconcile") {
    // Rebuild venue in_* flags from the indexed_journals registry (entity model;
    // no indexed_in tags). Per tenant. Sibling-aware (matches by issn_l + name).
    const tenants = (await sql`SELECT DISTINCT tenant_id FROM venues`).rows.map((r) => r.tenant_id);
    let updated = 0;
    for (const t of tenants) updated += await rebuildVenueFlags(t);
    return res.json({ ok: true, venuesFlagged: updated });
  }

  if (req.method === "POST" && req.query.action === "seed") {
    const sourceId = req.query.source;
    if (!sourceId) return res.status(400).json({ error: "source query param is required" });
    const { csv } = req.body || {};
    try {
      const result = await runSeed(sourceId, { csv });
      return res.json({ ok: true, ...result });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }

  res.status(405).json({ error: "Method not allowed" });
};

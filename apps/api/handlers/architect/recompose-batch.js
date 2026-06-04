// arch-audit-ignore: N1 — public anonymous endpoint by design (mirrors
// /recompose and /api/public/:slug/*). The auth firewall is per-kind in the
// recompose-registry: recomposePublicBatch composes ONLY access:'public' kinds,
// so no scope gate belongs here.
const { ensureSchema } = require("../../src/lib/db");
const { recomposePublicBatch } = require("../../src/services/architect/recompose-registry");

// POST /api/architect/recompose-batch
// Body: { tenantId, kinds: string[] }. Composes every requested PUBLIC kind in
// one round-trip → { [kind]: directive | null }. Lets the public charts tab
// fetch all its charts at once instead of N parallel requests that fill in
// staggered. Same per-kind composition + same public-only auth firewall as
// /recompose (unknown/scoped kinds are simply dropped to null by the registry).
module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  await ensureSchema();
  const body = req.body || {};
  const { tenantId, kinds, unit } = body;
  if (tenantId == null || !Array.isArray(kinds) || !kinds.length) {
    return res.status(400).json({ error: "tenantId and kinds[] are required" });
  }
  try {
    // unit (org-tree node unitKey) narrows every composed kind to one org unit;
    // safe by construction (resolves only against this tenant's roster literals).
    const directives = await recomposePublicBatch(String(tenantId), kinds.map(String), typeof unit === "string" ? unit : null);
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
    res.json({ directives });
  } catch (err) {
    console.error("[architect/recompose-batch]", err);
    res.status(500).json({ error: err.message });
  }
};

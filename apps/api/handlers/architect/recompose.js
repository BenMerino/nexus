const { ensureSchema } = require("../../src/lib/db");
const { recompose } = require("../../src/lib/architect-replay");

// POST /api/architect/recompose
// Body: a GraphQuery { kind, tenantId, windowDays?, asOf?, foldUnit? }.
// Returns a fresh GraphDirective with day-resolution atoms for the window.
// Public/read-only and tenant-scoped — drives the anonymous tenant charts'
// slider/toggles. Not authenticated by design (matches /api/public/:slug).
module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  await ensureSchema();
  const query = req.body || {};
  if (!query.kind || query.tenantId == null) {
    return res.status(400).json({ error: "query.kind and query.tenantId are required" });
  }
  try {
    const directive = await recompose(query);
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
    res.json(directive);
  } catch (err) {
    if (err.code === "UNKNOWN_KIND") return res.status(400).json({ error: err.message });
    throw err;
  }
};

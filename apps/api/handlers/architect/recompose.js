const { ensureSchema } = require("../../src/lib/db");
const { recomposePublic } = require("../../src/services/architect/recompose-registry");

// POST /api/architect/recompose
// Body: a GraphQuery { kind, tenantId, windowDays?, asOf?, foldUnit? }.
// Returns a fresh GraphDirective with day-resolution atoms for the window.
// Public/read-only and tenant-scoped — drives the anonymous tenant charts'
// slider/toggles. Not authenticated by design (matches /api/public/:slug).
//
// Delegates to the unified recompose-registry's PUBLIC entry: it refuses any
// kind that isn't registered `access:'public'`, so scoped data is unreachable
// from this anonymous endpoint (the auth-boundary firewall lives in the
// registry, enforced per-kind — not by trusting this endpoint).
module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  await ensureSchema();
  // Accept BOTH shapes: the body AS the query ({kind, tenantId, ...}) and the
  // wrapped form ({query: {...}}). Two callers historically disagreed — the
  // controller's recompose-client wraps; the public RecomposeChart sends flat.
  const body = req.body || {};
  const query = body.query && typeof body.query === "object" ? body.query : body;
  if (!query.kind || query.tenantId == null) {
    return res.status(400).json({ error: "query.kind and query.tenantId are required" });
  }
  try {
    const directive = await recomposePublic(query);
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
    res.json(directive);
  } catch (err) {
    if (err.code === "UNKNOWN_KIND") return res.status(400).json({ error: err.message });
    throw err;
  }
};

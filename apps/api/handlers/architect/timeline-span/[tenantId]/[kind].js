const { ensureSchema } = require("../../../../src/lib/db");
const { timelineSpan } = require("../../../../src/lib/architect-replay");

// GET /api/architect/timeline-span/:tenantId/:kind
// Returns { earliest, today, totalDays } — the genesis→today track the chart
// slider renders. Public/read-only and tenant-scoped (the tenant charts are
// anonymous). `kind` selects which metric's timeline (only publications today).
// Cached 5min, matching the client's useTimelineSpan expectation.
module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  await ensureSchema();
  const tenantId = parseInt(req.query.tenantId, 10);
  const kind = req.query.kind;
  if (!Number.isFinite(tenantId)) return res.status(400).json({ error: "Invalid tenantId" });

  try {
    const span = await timelineSpan(tenantId, kind);
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
    res.json(span);
  } catch (err) {
    if (err.code === "UNKNOWN_KIND") return res.status(400).json({ error: err.message });
    throw err;
  }
};

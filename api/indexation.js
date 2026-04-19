const { ensureSchema } = require("../lib/db");
const { requireRole } = require("../lib/auth");
const { listCounts } = require("../lib/indexed-journals");
const { runSeed } = require("../lib/indexation-seed");

module.exports = async function handler(req, res) {
  await ensureSchema();
  const sa = await requireRole(req, "superadmin");
  if (!sa) return res.status(403).json({ error: "Superadmin required" });

  if (req.method === "GET") {
    return res.json({ counts: await listCounts() });
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

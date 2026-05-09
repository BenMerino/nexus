const { ensureSchema } = require("../src/lib/db");
const { getGraphMetadata } = require("../src/lib/graph-meta");
const { requireScope } = require("../src/lib/scope");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  await ensureSchema();
  const scope = await requireScope(req, res);
  if (!scope) return;
  try {
    res.setHeader("Cache-Control", "no-store");
    const data = await getGraphMetadata(scope);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

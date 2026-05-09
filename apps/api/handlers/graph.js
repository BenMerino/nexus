const { ensureSchema } = require("../src/lib/db");
const { requireScope } = require("../src/lib/scope");
const { buildGraph } = require("../src/lib/graph-builder");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  await ensureSchema();
  const scope = await requireScope(req, res);
  if (!scope) return;
  try {
    res.setHeader("Cache-Control", "no-store");
    const graph = await buildGraph(scope);
    console.log("[graph] user:", scope.username, "role:", scope.role, "orcid:", scope.orcid, "nodes:", graph.nodes.length);
    res.json(graph);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

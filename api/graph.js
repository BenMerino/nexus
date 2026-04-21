const { ensureSchema } = require("../lib/db");
const { requireScope } = require("../lib/scope");
const { buildGraph } = require("../lib/graph-builder");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  await ensureSchema();
  const scope = await requireScope(req, res);
  if (!scope) return;
  try {
    res.setHeader("Cache-Control", "no-store");
    const graph = await buildGraph(scope);
    const authorsWithAffs = Object.keys(graph.affiliations?.byAuthor || {}).length;
    const authorNodes = graph.nodes.filter(n => n.group === "author");
    const instNodes = graph.nodes.filter(n => n.group === "institution");
    // Temporary: include a diagnostic block so we can see what's happening from the browser.
    graph._diag = {
      authorNodes: authorNodes.length,
      institutionNodes: instNodes.length,
      authorsWithAffs,
      sampleInstitutions: instNodes.slice(0, 5).map(n => ({ id: n.id, ext_id: n.ext_id, label: n.label })),
      sampleAuthorEntries: Object.entries(graph.affiliations?.byAuthor || {}).slice(0, 5),
    };
    console.log("[graph] user:", scope.username, "nodes:", graph.nodes.length, "authors:", authorNodes.length, "institutions:", instNodes.length, "authorsWithAffs:", authorsWithAffs);
    res.json(graph);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const { ensureSchema } = require("../../src/lib/db");
const { requireScope, actorContext } = require("../../src/lib/scope");
const { statComposer } = require("../../src/services/architect/StatComposer");

// GET /api/architect/charts  → server-composed dashboard chart directives
// (StatComposer over the Statistician resolver). Scope-narrowed. The DGA
// Resolver→Composer→GraphDirective seam, emitted server-side; the frontend
// GraphRenders these directly. ?kind=<name> returns a single directive.
module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  await ensureSchema();
  const scope = await requireScope(req, res);
  if (!scope) return;
  const ctx = await actorContext(req);
  try {
    if (req.query.kind) {
      const directive = await statComposer.compose(ctx, req.query.kind);
      return res.json(directive);
    }
    res.json({ charts: await statComposer.dashboard(ctx) });
  } catch (err) {
    if (err.code === "UNKNOWN_KIND") return res.status(400).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
};

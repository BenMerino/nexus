const { sql } = require("../../src/lib/sql");
const { ensureSchema } = require("../../src/lib/db");
const { requireScope, actorContext, isPersonalScope } = require("../../src/lib/scope");
const { recomposeScoped, dashboardScoped } = require("../../src/services/architect/recompose-registry");

// Resolve the viewed-researcher override (?orcid=): an admin/superadmin may view
// another researcher's charts; a personal-scope user may not. Returns the ctx to
// compose under (narrowed to the target like the dashboard's effectiveScope).
async function viewCtx(req, scope) {
  const ctx = await actorContext(req);
  const viewOrcid = req.query.orcid;
  if (!viewOrcid || viewOrcid === scope.orcid) return ctx;
  if (isPersonalScope(scope)) { const e = new Error("Personal scope cannot view other researchers"); e.code = "FORBIDDEN"; throw e; }
  const u = await sql`SELECT orcid FROM users WHERE tenant_id = ${scope.tenantId} AND active = TRUE AND orcid = ${viewOrcid} LIMIT 1`;
  if (!u.rows[0]) { const e = new Error("Researcher not found in your tenant"); e.code = "NOT_FOUND"; throw e; }
  return { ...ctx, orcid: viewOrcid, role: "user" };
}

// GET /api/architect/charts  → server-composed dashboard chart directives
// (StatComposer over the Statistician resolver). Scope-narrowed; honors ?orcid=
// like /api/dashboard. The DGA Resolver→Composer→GraphDirective seam, emitted
// server-side; the frontend GraphRenders these directly. ?kind=<name> → one.
module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  await ensureSchema();
  const scope = await requireScope(req, res);
  if (!scope) return;
  try {
    const ctx = await viewCtx(req, scope);
    // Scoped dispatch via the unified registry: these kinds run under the
    // resolved ActorContext (requireScope narrowing). The public POST endpoint
    // cannot reach them — access class is firewalled per-kind in the registry.
    if (req.query.kind) {
      return res.json(await recomposeScoped(ctx, req.query.kind));
    }
    res.json({ charts: await dashboardScoped(ctx) });
  } catch (err) {
    if (err.code === "FORBIDDEN") return res.status(403).json({ error: err.message });
    if (err.code === "NOT_FOUND") return res.status(404).json({ error: err.message });
    if (err.code === "UNKNOWN_KIND") return res.status(400).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
};

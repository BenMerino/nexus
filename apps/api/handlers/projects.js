const { ensureSchema } = require("../src/lib/db");
const { requireScope } = require("../src/lib/scope");
const { requireEditor } = require("../src/lib/auth");
const { projectGovernor } = require("../src/services/project/ProjectGovernor");

// Build the DGA ActorContext from an editor session (writes). requireEditor
// returns the session (id, tenantId, role…); the governor consumes ctx.
function editorCtx(session) {
  return {
    tenantId: session.tenantId,
    userId: String(session.id),
    displayName: session.username,
    actorKind: "user",
    role: session.role,
  };
}

module.exports = async function handler(req, res) {
  await ensureSchema();
  const action = req.query.action;

  if (req.method === "GET" && action === "list") {
    const scope = await requireScope(req, res);
    if (!scope) return;
    const rows = await projectGovernor.list(scope.tenantId);
    return res.json(rows);
  }

  if (req.method === "GET" && action === "get") {
    const scope = await requireScope(req, res);
    if (!scope) return;
    const id = parseInt(req.query.id, 10);
    if (!id) return res.status(400).json({ error: "Missing id" });
    const row = await projectGovernor.get(id, scope.tenantId);
    if (!row) return res.status(404).json({ error: "Not found" });
    return res.json(row);
  }

  if (req.method === "POST" && action === "create") {
    const session = await requireEditor(req);
    if (!session) return res.status(403).json({ error: "Forbidden" });
    const { investigators, ...fields } = req.body || {};
    if (!fields.titulo) return res.status(400).json({ error: "titulo required" });
    const id = await projectGovernor.create(editorCtx(session), { fields, investigators });
    return res.json({ ok: true, id });
  }

  if (req.method === "PUT" && action === "update") {
    const session = await requireEditor(req);
    if (!session) return res.status(403).json({ error: "Forbidden" });
    const { id, investigators, ...fields } = req.body || {};
    if (!id) return res.status(400).json({ error: "Missing id" });
    const ok = await projectGovernor.update(editorCtx(session), { id, fields, investigators });
    if (!ok) return res.status(404).json({ error: "Not found" });
    return res.json({ ok: true });
  }

  if (req.method === "DELETE" && action === "delete") {
    const session = await requireEditor(req);
    if (!session) return res.status(403).json({ error: "Forbidden" });
    const id = parseInt(req.query.id, 10);
    if (!id) return res.status(400).json({ error: "Missing id" });
    const ok = await projectGovernor.remove(editorCtx(session), id);
    if (!ok) return res.status(404).json({ error: "Not found" });
    return res.json({ ok: true });
  }

  return res.status(400).json({ error: "Unknown action" });
};

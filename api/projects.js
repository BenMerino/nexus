const { ensureSchema } = require("../lib/db");
const { requireScope } = require("../lib/scope");
const { requireRole } = require("../lib/auth");
const {
  listProjects, getProject, createProject, updateProject, deleteProject,
} = require("../lib/db-projects");

const EDITOR_ROLES = ["secretary", "director", "admin", "superadmin"];

module.exports = async function handler(req, res) {
  await ensureSchema();
  const action = req.query.action;

  if (req.method === "GET" && action === "list") {
    const scope = await requireScope(req, res);
    if (!scope) return;
    const rows = await listProjects(scope.tenantId);
    return res.json(rows);
  }

  if (req.method === "GET" && action === "get") {
    const scope = await requireScope(req, res);
    if (!scope) return;
    const id = parseInt(req.query.id, 10);
    if (!id) return res.status(400).json({ error: "Missing id" });
    const row = await getProject(id, scope.tenantId);
    if (!row) return res.status(404).json({ error: "Not found" });
    return res.json(row);
  }

  if (req.method === "POST" && action === "create") {
    const session = await requireRole(req, ...EDITOR_ROLES);
    if (!session) return res.status(403).json({ error: "Forbidden" });
    const { investigators, ...fields } = req.body || {};
    if (!fields.titulo) return res.status(400).json({ error: "titulo required" });
    const id = await createProject(session.tenantId, fields, investigators, session.id);
    return res.json({ ok: true, id });
  }

  if (req.method === "PUT" && action === "update") {
    const session = await requireRole(req, ...EDITOR_ROLES);
    if (!session) return res.status(403).json({ error: "Forbidden" });
    const { id, investigators, ...fields } = req.body || {};
    if (!id) return res.status(400).json({ error: "Missing id" });
    const ok = await updateProject(id, session.tenantId, fields, investigators);
    if (!ok) return res.status(404).json({ error: "Not found" });
    return res.json({ ok: true });
  }

  if (req.method === "DELETE" && action === "delete") {
    const session = await requireRole(req, ...EDITOR_ROLES);
    if (!session) return res.status(403).json({ error: "Forbidden" });
    const id = parseInt(req.query.id, 10);
    if (!id) return res.status(400).json({ error: "Missing id" });
    const ok = await deleteProject(id, session.tenantId);
    if (!ok) return res.status(404).json({ error: "Not found" });
    return res.json({ ok: true });
  }

  return res.status(400).json({ error: "Unknown action" });
};

const { ensureSchema } = require("../src/lib/db");
const { requireScope, actorContext } = require("../src/lib/scope");
const { requireEditor } = require("../src/lib/auth");
const { setAcceptedIndices } = require("../src/lib/claustro");
const { claustroResolver, PROGRAMS } = require("../src/services/catalog/Claustro");

module.exports = async function handler(req, res) {
  await ensureSchema();
  const action = req.query.action;

  if (req.method === "GET" && action === "list") {
    const scope = await requireScope(req, res);
    if (!scope) return;
    return res.json(await claustroResolver.list(await actorContext(req)));
  }

  if (req.method === "GET" && action === "validate") {
    const scope = await requireScope(req, res);
    if (!scope) return;
    const program = req.query.program;
    if (!PROGRAMS.includes(program)) return res.status(400).json({ error: "Invalid program" });
    return res.json(await claustroResolver.validate(await actorContext(req), program));
  }

  if (req.method === "GET" && action === "validate-all") {
    const scope = await requireScope(req, res);
    if (!scope) return;
    return res.json(await claustroResolver.validateAll(await actorContext(req)));
  }

  if (req.method === "GET" && action === "indices") {
    const scope = await requireScope(req, res);
    if (!scope) return;
    const indices = await claustroResolver.acceptedIndices(await actorContext(req));
    return res.json({ indices });
  }

  if (req.method === "PUT" && action === "indices") {
    const session = await requireEditor(req);
    if (!session) return res.status(403).json({ error: "Forbidden" });
    const { indices } = req.body || {};
    const saved = await setAcceptedIndices(session.tenantId, indices);
    return res.json({ ok: true, indices: saved });
  }

  return res.status(400).json({ error: "Unknown action" });
};

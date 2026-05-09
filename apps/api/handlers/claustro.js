const { ensureSchema } = require("../src/lib/db");
const { requireScope } = require("../src/lib/scope");
const { requireRole } = require("../src/lib/auth");
const {
  getClaustroForTenant, validateProgram, getAcceptedIndices, setAcceptedIndices,
} = require("../src/lib/claustro");

const EDITOR_ROLES = ["secretary", "director", "admin", "superadmin"];
const PROGRAMS = ["doctorado", "magister_academico", "magister_profesional"];

module.exports = async function handler(req, res) {
  await ensureSchema();
  const action = req.query.action;

  if (req.method === "GET" && action === "list") {
    const scope = await requireScope(req, res);
    if (!scope) return;
    const claustro = await getClaustroForTenant(scope.tenantId);
    return res.json(claustro);
  }

  if (req.method === "GET" && action === "validate") {
    const scope = await requireScope(req, res);
    if (!scope) return;
    const program = req.query.program;
    if (!PROGRAMS.includes(program)) return res.status(400).json({ error: "Invalid program" });
    const claustro = await getClaustroForTenant(scope.tenantId);
    return res.json(validateProgram(claustro, program));
  }

  if (req.method === "GET" && action === "validate-all") {
    const scope = await requireScope(req, res);
    if (!scope) return;
    const claustro = await getClaustroForTenant(scope.tenantId);
    const out = {};
    for (const p of PROGRAMS) out[p] = validateProgram(claustro, p);
    return res.json({ claustro, programs: out });
  }

  if (req.method === "GET" && action === "indices") {
    const scope = await requireScope(req, res);
    if (!scope) return;
    const indices = await getAcceptedIndices(scope.tenantId);
    return res.json({ indices });
  }

  if (req.method === "PUT" && action === "indices") {
    const session = await requireRole(req, ...EDITOR_ROLES);
    if (!session) return res.status(403).json({ error: "Forbidden" });
    const { indices } = req.body || {};
    const saved = await setAcceptedIndices(session.tenantId, indices);
    return res.json({ ok: true, indices: saved });
  }

  return res.status(400).json({ error: "Unknown action" });
};

// Tenant-data lifecycle endpoint. Superadmin or the tenant_admin of the target
// tenant. The supervision surface: preview the assessment plan (read-only), and
// (later phases) trigger refresh/maintain + read scheduler status. Gating mirrors
// roster-actions.authorize.
const { ensureSchema } = require("../src/lib/db");
const { getScope, actorContext } = require("../src/lib/scope");
const { assessor } = require("../src/services/lifecycle/Assessor");
const { refreshWorkflow } = require("../src/services/lifecycle/RefreshWorkflow");
const { maintenanceWorkflow } = require("../src/services/lifecycle/MaintenanceWorkflow");

function authorize(scope, tid) {
  if (scope.role === "superadmin") return true;
  return scope.tenantAdmin && scope.tenantId === tid;
}

module.exports = async function handler(req, res) {
  await ensureSchema();
  const action = req.query.action;
  const scope = await getScope(req);
  if (!scope) return res.status(401).json({ error: "Not authenticated" });

  // suggest-ror: provisioning a NEW tenant → superadmin only, tenant-independent
  // (no existing scope to authorize against). Sits before the tenant gate.
  if (req.method === "GET" && action === "suggest-ror") {
    if (scope.role !== "superadmin") return res.status(403).json({ error: "Superadmin required" });
    const { rorDispatcher } = require("../src/services/dispatch/RorDispatcher");
    return res.json({ suggestions: await rorDispatcher.suggestRor(req.query.name || "") });
  }

  const tid = req.query.tenant_id ? parseInt(req.query.tenant_id, 10) : scope.tenantId;
  if (!authorize(scope, tid)) {
    return res.status(403).json({ error: "Requires superadmin, or tenant admin of the target tenant" });
  }

  const ctx = { ...(await actorContext(req)), tenantId: tid };

  if (req.method === "GET" && action === "assess") {
    return res.json(await assessor.assess(ctx));
  }

  if (req.method === "POST" && action === "refresh") {
    const maxOrcids = req.query.max ? parseInt(req.query.max, 10) : undefined;
    return res.json(await refreshWorkflow.refresh(ctx, { maxOrcids }));
  }

  if (req.method === "GET" && action === "maintain") {
    return res.json(await maintenanceWorkflow.survey(ctx));
  }

  if (req.method === "GET" && action === "status") {
    // Durable status (the worker's in-memory run-state isn't visible cross-process).
    const { lifecycleRunInfo } = require("../src/lib/db-lifecycle");
    return res.json(await lifecycleRunInfo(tid));
  }

  if (req.method === "POST" && action === "merge-institutions") {
    const { fromId, intoId } = req.body || {};
    await maintenanceWorkflow.mergeConfirmed(ctx, parseInt(fromId, 10), parseInt(intoId, 10));
    return res.json({ ok: true });
  }

  return res.status(400).json({ error: "Unknown action" });
};

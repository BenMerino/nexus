// Roster admin actions split out of handlers/auth.js: CSV import, ORCID
// resolution, and publication ingest. Each is gated on superadmin OR the
// tenant_admin of the target tenant. Returns true if it handled the action
// (and has already written the response), false otherwise.
const { getScope } = require("../src/lib/scope");
const { listTenants } = require("../src/lib/db-users");

function authorize(scope, tid) {
  if (scope.role === "superadmin") return true;
  return scope.tenantAdmin && scope.tenantId === tid;
}

async function handleRosterAction(req, res) {
  const action = req.query.action;
  const ACTIONS = ["users-import", "roster-suggest", "roster-save-orcids", "roster-ingest"];
  if (!ACTIONS.includes(action)) return false;
  const scope = await getScope(req);
  if (!scope) { res.status(401).json({ error: "Not authenticated" }); return true; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return true; }

  if (action === "users-import") {
    const { csv, tenant_id } = req.body;
    const tid = tenant_id || (req.query.tenantId ? parseInt(req.query.tenantId) : null);
    if (!csv || !tid) { res.status(400).json({ error: "csv and tenant_id are required" }); return true; }
    if (!authorize(scope, tid)) { res.status(403).json({ error: "Requires superadmin, or tenant admin of the target tenant" }); return true; }
    const { parseRoster, importRoster } = require("../src/lib/roster-import");
    const rows = parseRoster(csv);
    res.json({ ok: true, parsed: rows.length, ...(await importRoster(rows, tid)) });
    return true;
  }

  const tid = req.body?.tenant_id || scope.tenantId;
  if (!authorize(scope, tid)) { res.status(403).json({ error: "Requires superadmin, or tenant admin of the target tenant" }); return true; }

  // Writing admin-confirmed ORCIDs needs no ROR / OpenAlex.
  if (action === "roster-save-orcids") {
    const { saveOrcids } = require("../src/lib/roster-resolve");
    res.json({ ok: true, ...(await saveOrcids(tid, req.body?.assignments)) });
    return true;
  }

  // suggest / ingest both query OpenAlex under the tenant ROR.
  const tenants = await listTenants();
  const ror = tenants.find(t => t.id === tid)?.ror_id;
  if (!ror) { res.status(400).json({ error: "Tenant has no ROR id; cannot query OpenAlex" }); return true; }

  if (action === "roster-suggest") {
    const { suggestOrcids } = require("../src/lib/roster-resolve");
    const limit = Math.min(parseInt(req.body?.limit) || 30, 50);
    const offset = parseInt(req.body?.offset) || 0;
    res.json({ ok: true, ...(await suggestOrcids(tid, ror, limit, offset)) });
    return true;
  }

  const { ingestResolved } = require("../src/lib/roster-ingest");
  const limit = Math.min(parseInt(req.body?.limit) || 25, 50);
  const offset = parseInt(req.body?.offset) || 0;
  res.json({ ok: true, ...(await ingestResolved(tid, "roster-ingest:" + scope.username, limit, offset)) });
  return true;
}

module.exports = { handleRosterAction };

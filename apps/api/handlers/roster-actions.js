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
  const ACTIONS = ["users-import", "roster-list", "roster-suggest", "roster-save-orcids", "roster-ingest", "roster-ingest-start", "roster-ingest-status", "org-tree"];
  if (!ACTIONS.includes(action)) return false;
  const scope = await getScope(req);
  if (!scope) { res.status(401).json({ error: "Not authenticated" }); return true; }

  // roster-ingest-status: live progress of the background paper-ingest, polled
  // by the roster UI indicator. GET; tenant-admin (or superadmin) of the tenant.
  if (action === "roster-ingest-status") {
    const tid = req.query.tenantId ? parseInt(req.query.tenantId) : scope.tenantId;
    if (!authorize(scope, tid)) { res.status(403).json({ error: "Requires superadmin, or tenant admin of the target tenant" }); return true; }
    const { getTenantIngestStatus } = require("../src/lib/ingest-runner");
    res.json({ ok: true, ...getTenantIngestStatus(tid) });
    return true;
  }

  // org-tree: the org scheme view. Read-only and visible to ANY authenticated
  // user of the tenant (no tenant_admin gate), so it bypasses authorize().
  if (action === "org-tree") {
    const tid = req.query.tenantId ? parseInt(req.query.tenantId) : scope.tenantId;
    const { queryOrgTree } = require("../src/lib/org-tree");
    res.json({ ok: true, ...(await queryOrgTree(tid)) });
    return true;
  }

  // roster-list is a GET; everything else is a POST.
  if (action === "roster-list") {
    const tid = req.query.tenantId ? parseInt(req.query.tenantId) : scope.tenantId;
    if (!authorize(scope, tid)) { res.status(403).json({ error: "Requires superadmin, or tenant admin of the target tenant" }); return true; }
    const { queryRoster, ROSTER_SORT } = require("../src/lib/roster-resolve");
    const { parseTableQuery, TableQueryValidationError } = require("../src/lib/table-query");
    try {
      const query = parseTableQuery(req.query, {
        sortable: ROSTER_SORT,
        defaultSort: { columnId: "name", direction: "asc" },
        maxPageSize: 100,
      });
      res.json({ ok: true, ...(await queryRoster(tid, query)) });
    } catch (err) {
      if (err instanceof TableQueryValidationError) { res.status(400).json({ error: err.message }); }
      else throw err;
    }
    return true;
  }

  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return true; }

  if (action === "users-import") {
    const { csv, tenant_id } = req.body;
    const tid = tenant_id || (req.query.tenantId ? parseInt(req.query.tenantId) : null);
    if (!csv || !tid) { res.status(400).json({ error: "csv and tenant_id are required" }); return true; }
    if (!authorize(scope, tid)) { res.status(403).json({ error: "Requires superadmin, or tenant admin of the target tenant" }); return true; }
    const { parseRoster, importRoster } = require("../src/lib/roster-import");
    const rows = parseRoster(csv);
    const imp = await importRoster(rows, tid);
    // Auto-ingest: if the import brought in ORCID-linked academics, pull their
    // papers in the background (non-blocking). The import response returns now;
    // ingest runs in-process afterward. Triggered whenever the roster gained or
    // updated academics, since either can introduce new ORCIDs.
    let ingest = { started: false };
    if (imp.created > 0 || imp.updated > 0) {
      const { startTenantIngest } = require("../src/lib/ingest-runner");
      ingest = startTenantIngest(tid, "roster-import:" + scope.username);
      // Durable cross-process signal: the worker's lifecycle scheduler kicks a
      // governed refresh for this tenant (the in-process startTenantIngest above
      // is the immediate path; the event survives if the worker was busy/down).
      const { eventBus } = require("../src/services/EventBus");
      eventBus.emit("roster.imported", { tenantId: tid, added: imp.created + imp.updated });
    }
    res.json({ ok: true, parsed: rows.length, ...imp, autoIngest: ingest });
    return true;
  }

  const tid = req.body?.tenant_id || scope.tenantId;
  if (!authorize(scope, tid)) { res.status(403).json({ error: "Requires superadmin, or tenant admin of the target tenant" }); return true; }

  // Manual kick of the background paper-ingest for the whole tenant (e.g. to
  // ingest ORCIDs that arrived via the backfill migration rather than import).
  // Runs in-process inside the app; returns immediately.
  if (action === "roster-ingest-start") {
    const { startTenantIngest } = require("../src/lib/ingest-runner");
    res.json({ ok: true, ...startTenantIngest(tid, "manual-start:" + scope.username) });
    return true;
  }

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

/* ── LifecycleWorkflow ─────────────────────────────────────────
 * The unit the worker's scheduler dispatches per tenant: assess → refresh →
 * maintain-survey, bounded and audit-logged. A Workflow — it orchestrates the
 * lifecycle workflows/resolvers (which in turn call governors).
 *
 * Today it RUNS the refresh (keep-fresh) and SURVEYS maintenance (keep-clean is
 * suggest-only for institutions — see MaintenanceWorkflow). The assessment is
 * computed first so the run is observable ("what did it decide, then do"). The
 * tenant's last_lifecycle_run_at is stamped at the end so the scheduler rotates
 * to the next least-recently-serviced tenant.
 * ──────────────────────────────────────────────────────────── */

import { systemActor } from "../../substrate/actor";
import { assessor } from "./Assessor";
import { refreshWorkflow, type RefreshResult } from "./RefreshWorkflow";
import { maintenanceWorkflow } from "./MaintenanceWorkflow";
const lifecycle = require("../../lib/db-lifecycle");

export interface LifecycleRunResult {
  tenantId: number;
  plan: Awaited<ReturnType<typeof assessor.assess>>;
  refresh: RefreshResult;
  duplicateInstitutions: number;
}

class LifecycleWorkflow {
  /** Run one tenant's upkeep. `maxOrcids` bounds the refresh so one tenant can't
   *  monopolize a tick (the scheduler enforces fairness across tenants). */
  async runTenant(tenantId: number, opts: { maxOrcids?: number } = {}): Promise<LifecycleRunResult> {
    const ctx = systemActor(tenantId, "lifecycle");
    const plan = await assessor.assess(ctx);
    const refresh = await refreshWorkflow.refresh(ctx, { maxOrcids: opts.maxOrcids ?? 25 });
    const survey = await maintenanceWorkflow.survey(ctx);
    await lifecycle.markTenantLifecycleRun(tenantId);
    return { tenantId, plan, refresh, duplicateInstitutions: survey.duplicateInstitutions.length };
  }
}

export const lifecycleWorkflow = new LifecycleWorkflow();

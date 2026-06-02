/* ── lifecycle-listeners (worker-only) ─────────────────────────
 * The first real eventBus.on usage: cross-process events delivered by the
 * OutboxRelay into the worker's in-process bus trigger an immediate lifecycle
 * run. Registered once at worker start (after the relay + scheduler).
 *
 * tenant.provisioned → kick the new tenant's FIRST load.
 * roster.imported    → kick a refresh (new/updated academics may add ORCIDs).
 * The scheduler's per-tenant overlap guard makes a kick safe even if a manual
 * import is already running.
 * ──────────────────────────────────────────────────────────── */

import { eventBus } from "../EventBus";
import { lifecycleScheduler } from "./LifecycleScheduler";

export function registerLifecycleListeners(): void {
  eventBus.on("tenant.provisioned", (p) => {
    console.log(`[lifecycle] tenant.provisioned tenant=${p.tenantId} → kick first load`);
    lifecycleScheduler.kick(p.tenantId);
  });
  eventBus.on("roster.imported", (p) => {
    console.log(`[lifecycle] roster.imported tenant=${p.tenantId} added=${p.added} → kick refresh`);
    lifecycleScheduler.kick(p.tenantId);
  });
}

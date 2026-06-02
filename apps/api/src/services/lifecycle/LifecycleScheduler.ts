/* ── LifecycleScheduler (worker-only) ──────────────────────────
 * Drives automatic tenant upkeep. Runs ONLY in the worker process. A periodic
 * tick picks the least-recently-serviced eligible tenant and runs one bounded
 * LifecycleWorkflow.runTenant; `kick(tenantId)` runs one immediately (fired by
 * the event listeners on tenant.provisioned / roster.imported).
 *
 * Fairness: one tenant per tick, oldest last_lifecycle_run_at first, bounded
 * refresh per run → no tenant starves another (selection is least-recently-
 * serviced, not biggest-first). Cadence is DURABLE (tenants.last_lifecycle_run_at),
 * so it survives restarts; the in-memory status is best-effort.
 * Overlap: a module `busy` flag (one run at a time) + the existing per-tenant
 * ingest-runner lock, so a manual import in flight is respected and skipped.
 * setInterval is .unref()'d so it never blocks worker shutdown.
 * ──────────────────────────────────────────────────────────── */

import { lifecycleWorkflow } from "./LifecycleWorkflow";
import { setRunning, noteTick, startRun, finishRun, failRun } from "./lifecycle-status";
const lifecycle = require("../../lib/db-lifecycle");
const { isRunning } = require("../../lib/ingest-runner");

const TICK_MS = Number(process.env.LIFECYCLE_TICK_MS) || 6 * 60 * 60 * 1000; // 6h
const MIN_INTERVAL_H = Number(process.env.LIFECYCLE_MIN_INTERVAL_H) || 20;   // ~nightly
const MAX_ORCIDS = Number(process.env.LIFECYCLE_MAX_ORCIDS) || 25;

class LifecycleScheduler {
  private busy = false;
  private timer: NodeJS.Timeout | null = null;

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.timer.unref();
    setTimeout(() => this.tick(), 60_000).unref(); // first run shortly after boot
    console.log(`[LifecycleScheduler] started (tick ${TICK_MS}ms, min-interval ${MIN_INTERVAL_H}h)`);
  }

  // One tick: the next least-recently-serviced eligible tenant.
  private async tick(): Promise<void> {
    if (this.busy) return;
    this.busy = true; setRunning(true);
    try {
      const tenant = await lifecycle.nextEligibleTenant(MIN_INTERVAL_H);
      noteTick(tenant?.id ?? null);
      if (tenant) await this.runOne(tenant.id);
    } catch (e) {
      console.error("[LifecycleScheduler] tick error:", (e as Error).message);
    } finally {
      this.busy = false; setRunning(false);
    }
  }

  // Event-driven immediate run (provision / roster import). Best-effort.
  kick(tenantId: number): void {
    this.runOne(tenantId).catch((e) => console.error(`[LifecycleScheduler] kick(${tenantId}) failed:`, e.message));
  }

  private async runOne(tenantId: number): Promise<void> {
    if (isRunning(tenantId)) { console.log(`[LifecycleScheduler] tenant ${tenantId} busy — skip`); return; }
    startRun(tenantId);
    try {
      const r = await lifecycleWorkflow.runTenant(tenantId, { maxOrcids: MAX_ORCIDS });
      finishRun(tenantId, r.refresh.imported);
    } catch (e) {
      failRun(tenantId, (e as Error).message);
      throw e;
    }
  }

  stop(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }
}

export const lifecycleScheduler = new LifecycleScheduler();

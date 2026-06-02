/* ── lifecycle-status ──────────────────────────────────────────
 * In-memory observability for the worker's scheduler (mirrors ingest-runner's
 * status Map). Lost on restart — that's fine; durable cadence lives in
 * tenants.last_lifecycle_run_at. This is just "what is the worker doing now".
 * ──────────────────────────────────────────────────────────── */

export interface TenantRunStatus {
  state: "running" | "done" | "error";
  imported?: number;
  startedAt: number;
  finishedAt?: number;
  error?: string;
}

const tenantStatus = new Map<number, TenantRunStatus>();
let global = { lastTickAt: 0, lastTenant: null as number | null, running: false };

export function setRunning(on: boolean): void { global.running = on; }
export function noteTick(tenantId: number | null): void {
  global.lastTickAt = Date.now();
  global.lastTenant = tenantId;
}
export function startRun(tenantId: number): void {
  tenantStatus.set(tenantId, { state: "running", startedAt: Date.now() });
}
export function finishRun(tenantId: number, imported: number): void {
  const s = tenantStatus.get(tenantId);
  tenantStatus.set(tenantId, { ...(s as TenantRunStatus), state: "done", imported, finishedAt: Date.now() });
}
export function failRun(tenantId: number, error: string): void {
  const s = tenantStatus.get(tenantId);
  tenantStatus.set(tenantId, { ...(s as TenantRunStatus), state: "error", error, finishedAt: Date.now() });
}
export function lifecycleStatus() {
  return { ...global, tenants: Object.fromEntries(tenantStatus) };
}

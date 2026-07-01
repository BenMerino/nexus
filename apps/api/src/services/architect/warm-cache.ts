/* ── DirectiveCache warmer ──────────────────────────────────
 * Precomputes every public chart directive for every active tenant once at
 * boot, so the DirectiveCache (in-process Map, wiped on each Railway deploy)
 * is warm before the first visitor arrives.
 *
 * WHY: the batch/parallel/cache path is already correct — but the cache is
 * per-process and Nexus redeploys on every push, so the FIRST viewer of each
 * (kind, tenant) after a deploy pays the full cold compute (the collaborators/
 * countries COUNT(DISTINCT) over the ~280k-row affiliation fanout ran ~450-800ms
 * on prod). perf_beacon showed those cold chart phases dominating the p95 tail.
 * Warming moves that cost off the user's critical path onto boot.
 *
 * Best-effort and non-blocking: fired after app.listen, never awaited, never
 * throws into the boot path. Tenants are warmed sequentially with a small gap
 * so the startup burst doesn't exhaust the pg pool (max 10) while the server is
 * also serving first requests. Uses the SAME recomposePublicBatch the HTTP
 * endpoint uses, so a warmed entry is a byte-identical cache hit.
 * ──────────────────────────────────────────────────────────── */

import { ANALYTICS_METRICS } from "../analytics/AnalyticsCatalog";
import { recomposePublicBatch } from "./recompose-registry";

const { listTenants } = require("../../lib/db-users");

/** Every catalog kind a public page can request. kpiSparks is public too but
 *  fetched on its own endpoint; batch-warming the chart kinds covers the tab. */
const PUBLIC_KINDS: string[] = ANALYTICS_METRICS
  .filter((m) => m.access === "public")
  .map((m) => m.kind);

/** Sleep helper — spaces tenant warms so the boot burst is gentle on the pool. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function warmDirectiveCache(): Promise<void> {
  try {
    const tenants: Array<{ id: number; active?: boolean }> = await listTenants();
    const active = tenants.filter((t) => t.active !== false);
    if (!active.length) return;
    console.log(`[warm] priming ${PUBLIC_KINDS.length} public kinds × ${active.length} tenant(s)`);
    for (const t of active) {
      try {
        await recomposePublicBatch(String(t.id), PUBLIC_KINDS, null);
      } catch (err) {
        console.warn(`[warm] tenant ${t.id} skipped:`, (err as Error).message);
      }
      await delay(250); // let first real requests through between tenants
    }
    console.log("[warm] DirectiveCache primed");
  } catch (err) {
    // Warming is an optimization; a failure must never affect the running server.
    console.warn("[warm] skipped:", (err as Error).message);
  }
}

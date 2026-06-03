import { eventBus } from "../EventBus";
import { streamKeyOf } from "./stream-key-server";
import { ANALYTICS_METRICS } from "../analytics/AnalyticsCatalog";

/* ── DirectiveCache ─────────────────────────────────────────
 * Compute-once directive cache shared by BOTH serve paths — the HTTP recompose
 * (recompose-registry) and the WS StreamRegistry. Mirrors Zincro's
 * StreamRegistry value cache: a composed directive is identical for every
 * anonymous viewer of a (kind, tenant, window) until a domain event changes
 * the underlying data, so we compute it once and reuse it.
 *
 * Invalidation is event-driven, NOT time-based: each AnalyticsCatalog metric
 * declares `invalidatedBy: GovernorEvent[]`; at boot we wire those events to
 * bust the matching cache entries (by kind + tenant). This is the consumer the
 * catalog's `invalidatedBy` field was always for.
 *
 * Keyed by `streamKeyOf(query)` (the same canonical key the WS layer uses), so
 * window/asOf variants cache independently. In-memory, per-process; the worker
 * and web each keep their own — fine, since invalidation events fan out to
 * both over the existing EventBus + outbox backbone.
 * ──────────────────────────────────────────────────────────── */

interface Entry { value: unknown; computedAt: number; kind: string; tenantId: string }

class DirectiveCache {
  private byKey = new Map<string, Entry>();
  private wired = false;

  /** Return the cached directive for `query`, or compute it once via `fn`,
   *  store, and return. Concurrent callers for the same key may both compute
   *  on a cold key (no in-flight dedupe) — acceptable: the result is identical
   *  and the second write is idempotent. */
  async getOrCompute(query: { kind: string; tenantId: string }, fn: () => Promise<unknown>): Promise<unknown> {
    const key = streamKeyOf(query);
    const hit = this.byKey.get(key);
    if (hit) return hit.value;
    const value = await fn();
    this.byKey.set(key, { value, computedAt: Date.now(), kind: query.kind, tenantId: String(query.tenantId) });
    return value;
  }

  /** Drop every entry for a (kind, tenant). Called by the invalidatedBy hook. */
  invalidate(kind: string, tenantId: string | number): void {
    const tid = String(tenantId);
    for (const [key, e] of this.byKey) {
      if (e.kind === kind && e.tenantId === tid) this.byKey.delete(key);
    }
  }

  /** Drop ALL kinds for a tenant. The cross-process path (outbox NOTIFY →
   *  StreamInvalidationListener) only carries a tenantId, not the kind, so it
   *  busts the whole tenant — coarse but correct (ingestion changes most
   *  publication-derived charts anyway). */
  invalidateTenant(tenantId: string | number): void {
    const tid = String(tenantId);
    for (const [key, e] of this.byKey) {
      if (e.tenantId === tid) this.byKey.delete(key);
    }
  }

  /** Wire the catalog's `invalidatedBy` events → cache busts. Idempotent;
   *  call once at boot (both web and worker processes). */
  wireInvalidation(): void {
    if (this.wired) return;
    this.wired = true;
    for (const metric of ANALYTICS_METRICS) {
      for (const event of metric.invalidatedBy) {
        eventBus.on(event, (payload: { tenantId?: number }) => {
          if (payload && payload.tenantId != null) this.invalidate(metric.kind, payload.tenantId);
        });
      }
    }
  }

  /** Test/diagnostic: current entry count. */
  size(): number {
    return this.byKey.size;
  }
}

export const directiveCache = new DirectiveCache();

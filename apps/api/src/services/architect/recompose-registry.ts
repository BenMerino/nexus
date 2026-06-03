/* ── Recompose Registry (Composer dispatch) ─────────────────
 * THE single server seam for chart composition. Both architect endpoints
 * delegate here:
 *   - POST /api/architect/recompose  → recomposePublic(query)   (anonymous tenant-public)
 *   - GET  /api/architect/charts     → recomposeScoped(ctx,kind) (requireScope-gated)
 *
 * Every chart `kind` registers once with an ACCESS CLASS. The auth boundary
 * is enforced HERE, per-kind — not by trusting which endpoint called:
 *   - `public`  kinds read only tenant-public data (by tenantId); the public
 *     POST endpoint serves these. A scoped kind hitting the public endpoint
 *     is REFUSED (UNKNOWN_KIND) — it can never reach scoped reads.
 *   - `scoped`  kinds run under an ActorContext (requireScope narrowing); only
 *     the authenticated GET endpoint can dispatch them.
 *
 * Mirrors the client's single DirectiveChart path on the server side. New
 * charts add a row here — they cannot pick the "wrong" path.
 * ──────────────────────────────────────────────────────────── */

import type { ActorContext } from "../../substrate/actor";
import { statComposer, type ServerGraphDirective } from "./StatComposer";
import { streamKeyOf } from "./stream-key-server";
import { ANALYTICS_METRICS } from "../analytics/AnalyticsCatalog";
import type { CatalogQuery } from "../analytics/analytics-catalog.types";

export type AccessClass = "public" | "scoped";

// The wire query is the catalog query; alias kept for the existing handler
// imports (PublicQuery) so call sites don't churn.
export type PublicQuery = CatalogQuery;

function unknownKind(kind: string): Error & { code: string } {
  const e = new Error(`Unknown chart kind: ${kind}`) as Error & { code: string };
  e.code = "UNKNOWN_KIND";
  return e;
}

/** Public kinds, GENERATED from the AnalyticsCatalog — the registry is derived,
 *  not hand-maintained, so a chart cannot exist outside the catalog and no
 *  monolithic stat blob can re-form. Adding a public chart = one catalog entry.
 *  Each entry's `compose` reads only tenant-public data (its query carries
 *  tenantId); a scoped kind hitting the public endpoint is refused below. */
const PUBLIC_KINDS: Record<string, (query: CatalogQuery) => Promise<unknown>> = Object.fromEntries(
  ANALYTICS_METRICS.filter((m) => m.access === "public").map((m) => [m.kind, m.compose]),
);

/** Scoped kinds: composed under an ActorContext (requireScope narrowing).
 *  Delegates to the existing StatComposer registry — single source of the
 *  dashboard kinds, now reachable through the unified dispatch. */
async function composeScoped(ctx: ActorContext, kind: string): Promise<unknown> {
  if (!statComposer.kinds().includes(kind)) throw unknownKind(kind);
  return statComposer.compose(ctx, kind);
}

/** Access class for a kind, or null if unregistered. */
export function accessOf(kind: string): AccessClass | null {
  if (kind in PUBLIC_KINDS) return "public";
  if (statComposer.kinds().includes(kind)) return "scoped";
  return null;
}

/** Public entry — the anonymous POST endpoint. Refuses any kind that is not
 *  registered `public`, so scoped data is unreachable from here. */
export async function recomposePublic(query: PublicQuery): Promise<unknown> {
  const fn = PUBLIC_KINDS[query.kind];
  if (!fn) throw unknownKind(query.kind);
  const directive = await fn(query) as Record<string, unknown>;
  // Stamp the canonical stream key from the directive's own (normalized)
  // query so the Phase-C client can subscribe without re-canonicalizing.
  if (directive && directive.query && typeof directive.query === "object") {
    directive.streamKey = streamKeyOf(directive.query as Record<string, unknown>);
  }
  return directive;
}

/** Scoped entry — the authenticated GET endpoint, under a resolved ctx. */
export async function recomposeScoped(ctx: ActorContext, kind: string): Promise<unknown> {
  return composeScoped(ctx, kind);
}

/** All scoped kinds — the dashboard composes the full set. */
export async function dashboardScoped(ctx: ActorContext): Promise<ServerGraphDirective[]> {
  return statComposer.dashboard(ctx);
}

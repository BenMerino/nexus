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

// architect-replay is legacy JS in lib/; the whole app compiles to dist/ 1:1
// so this require resolves to the compiled sibling at runtime (tsconfig
// allowJs). Typed loosely — it predates the TS migration.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const replay = require("../../lib/architect-replay") as {
  recompose: (query: PublicQuery) => Promise<ServerGraphDirective & { atoms: unknown[]; query: PublicQuery }>;
};

export type AccessClass = "public" | "scoped";

export interface PublicQuery {
  kind: string;
  tenantId: string;
  windowDays?: number | null;
  asOf?: string;
  foldUnit?: string;
}

function unknownKind(kind: string): Error & { code: string } {
  const e = new Error(`Unknown chart kind: ${kind}`) as Error & { code: string };
  e.code = "UNKNOWN_KIND";
  return e;
}

/** Public kinds: composed from a query carrying its own tenantId, reading only
 *  tenant-public data. Delegates to the existing atom-replay builder. */
const PUBLIC_KINDS: Record<string, (query: PublicQuery) => Promise<unknown>> = {
  publications: (query) => replay.recompose(query),
};

/** Scoped kinds: composed under an ActorContext (requireScope narrowing).
 *  Delegates to the existing StatComposer registry — single source of the
 *  dashboard kinds, now reachable through the unified dispatch. */
async function composeScoped(ctx: ActorContext, kind: string): Promise<ServerGraphDirective | null> {
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
export async function recomposeScoped(ctx: ActorContext, kind: string): Promise<ServerGraphDirective | null> {
  return composeScoped(ctx, kind);
}

/** All scoped kinds — the dashboard composes the full set. */
export async function dashboardScoped(ctx: ActorContext): Promise<ServerGraphDirective[]> {
  return statComposer.dashboard(ctx);
}

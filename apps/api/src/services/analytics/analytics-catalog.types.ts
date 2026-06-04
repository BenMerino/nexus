import type { GovernorEvent } from "../EventBus";

/* ── AnalyticsCatalog Types & Adapters ──────────────────────
 * Type contract + query-shape adapters for the analytics catalog.
 * Lives in its own file so the catalog manifest stays focused on
 * metric *data*; this file holds the *scaffolding*.
 *
 * Mirrors Zincro's analytics-catalog.types shape (the inherited source of
 * truth). Adapted to Nexus's substrate: the api does NOT import the web-side
 * graph mirrors (it defines its own server-side shapes, as StatComposer's
 * `ServerGraphDirective` already does), tenantId is a string in the wire
 * query, and events come from Nexus's GovernorEventMap.
 * ──────────────────────────────────────────────────────────── */

/** Surfaces a metric is exposed on. Subset views derive from this. */
export type AnalyticsSurface = "overview" | "ai" | "showcase";

/** Shape of query parameters this metric accepts beyond `kind`+`tenantId`.
 *  Each shape maps 1:1 to one of the existing composer signatures:
 *   - 'range': `windowDays` + `asOf` (time-series with a slider)
 *   - 'scope': `scope` (snapshot averaged over today/week/month)
 *   - 'none':  no extra params (full-history aggregates) */
export type AnalyticsQueryShape = "range" | "scope" | "none";

/** Access class — which endpoint may dispatch this kind. Public kinds read
 *  only tenant-public data (anonymous POST); scoped kinds run under a
 *  requireScope-narrowed ActorContext (authenticated GET). */
export type AnalyticsAccess = "public" | "scoped";

/** Chart overlay declaration — the subset of the engine's GraphFeature the
 *  catalog declares server-side. Mirrors the mirror's `kind` discriminator
 *  without importing the web tree. */
export type CatalogFeature =
  | { kind: "trendline"; method?: "linear" }
  | { kind: "movingAverage"; window: number }
  | { kind: "averageLine" }
  | { kind: "minMaxMarkers" };

/** The runtime query a public/scoped recompose carries. `ctx` is the resolved
 *  ActorContext for scoped kinds (set by the scoped endpoint); public kinds
 *  read tenantId only (a string on the wire — integer tenants are parsed by
 *  the composer). */
export interface CatalogQuery {
  kind: string;
  tenantId: string;
  windowDays?: number | null;
  asOf?: string;
  foldUnit?: string;
  scope?: "today" | "week" | "month";
  /** Org-unit drill-down key (org-tree node's `unitKey`). Narrows the read to
   *  one faculty/department; absent ⇒ whole tenant. See lib/org-units.js. */
  unit?: string | null;
  /** Resolved ActorContext for scoped kinds; absent for public dispatch. */
  ctx?: unknown;
}

/** Catalog entry — the manifest row for one graphable metric. */
export interface AnalyticsMetric {
  /** Stable identifier — used as `query.kind` and stream-kind. */
  kind: string;
  /** Owning domain (publication, venue, …) — for grouping in UIs. */
  domain: string;
  /** Human-readable title for selection UIs and AI summaries. */
  title: string;
  /** One-liner for chart pickers and AI tool descriptions. */
  description: string;
  /** Query parameter shape — see `AnalyticsQueryShape`. */
  queryShape: AnalyticsQueryShape;
  /** Which endpoint may dispatch this kind. */
  access: AnalyticsAccess;
  /** Compose: query → directive | null. Uniform across all entries. */
  compose: (q: CatalogQuery) => Promise<unknown | null>;
  /** EventBus events that invalidate this metric's cached value. Typed
   *  against `GovernorEventMap` so a typo or removed event fails the build.
   *  (No analytics cache consumes this yet — declared for parity with the
   *  inherited catalog and the cache pass that lands later.) */
  invalidatedBy: readonly GovernorEvent[];
  /** Where this metric is exposed. */
  surfaces: readonly AnalyticsSurface[];
  /** Optional chart overlays merged onto the directive by `withFeatures`. */
  features?: readonly CatalogFeature[];
}

/** Range query → composer opts. The query → opts mapping lives here so the
 *  domain composers stay decoupled from the catalog. */
export const rangeOpts = (q: CatalogQuery) => ({ windowDays: q.windowDays, asOf: q.asOf, foldUnit: q.foldUnit });
export const scopeOpts = (q: CatalogQuery) => ({ scope: q.scope });

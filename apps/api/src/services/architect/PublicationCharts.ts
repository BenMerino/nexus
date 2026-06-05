/* ── PublicationCharts (Composer presentation for time-series kinds) ──
 * The single place that PRESENTS publication time-charts as directives — the
 * Zincro `{Domain}Logic` + catalog pattern (OrderTimeSeriesLogic). Each builder:
 *   1. INTERPRET — derive the chartable series ON READ from raw publications
 *      (no rollup table; "cadence"/"by-index" are methodologic interpretations,
 *      not stored entities). The SQL + grouping live in the N4 `.js` data libs.
 *   2. PRESENT — emit an ATOM directive (per-day real ISO + per-series siblings,
 *      data:[] , aggregator:'sum'). Because every time directive carries atoms by
 *      construction here, and this Composer is the only path the registry routes
 *      time kinds through, a non-time-series (year-collapsed) chart cannot be
 *      produced. The engine folds atoms → year buckets and pairs stacked
 *      segments by date → the legend toggle drops uniformly.
 *
 * No frontend `build*Chart` for these — pages fetch the composed directive.
 * ──────────────────────────────────────────────────────────── */

import type { ActorContext } from "../../substrate/actor";
import type { CatalogQuery } from "../analytics/analytics-catalog.types";
import { pubGranularityToggle, type PubToggle } from "./pub-window-toggle";

// The read scope the N4 libs consume — a subset of ActorContext (DGA scope model:
// ctx IS the read scope; personal scope narrows to the actor's own papers).
type Scope = Pick<ActorContext, "tenantId" | "orcid" | "ror" | "role" | "unitKey">;
const scopeOf = (ctx: ActorContext): Scope =>
  ({ tenantId: ctx.tenantId, orcid: ctx.orcid ?? null, ror: ctx.ror ?? null, role: ctx.role, unitKey: ctx.unitKey ?? null });

// N4 data libs (CJS) — raw SQL + day/type aggregation only.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cadenceLib = require("../../lib/public-cadence-atoms") as {
  buildCadenceAtoms: (scope: Scope) => Promise<{ atoms: unknown[]; series: string[]; meanPerYear: number }>;
};
// eslint-disable-next-line @typescript-eslint/no-var-requires
const indexLib = require("../../lib/public-stats-atoms") as {
  buildIndexationAtoms: (scope: Scope) => Promise<{ atoms: unknown[]; series: string[] }>;
};

export interface TimeChartDirective {
  type: "stacked-bar";
  title: string;
  xLabel: string;
  yLabel: string;
  series: string[];
  aggregator: "sum";
  atoms: unknown[];
  data: never[];
  thresholds?: { value: number; label: string; color: string }[];
  /** KPI headline. `reduce:'mean'` derives papers/year from the plotted
   *  buckets in the engine, so it tracks window/fold (cosmetic path). */
  kpi?: { caption: string; reduce?: "mean" | "sum" | "last" | "first" | "min" | "max" | "count" | "slope"; figure?: string; trend?: "auto" | { direction: "rising" | "flat" | "falling"; label: string } };
  /** Replay fields — present makes the directive REPLAYABLE: DirectiveChart
   *  mounts the controller (window slider + drill). The atoms are full-span;
   *  the client slices the window (Zincro contract — no server re-window). */
  query?: { kind: string; tenantId: string; windowDays: number | null; asOf?: string; foldUnit?: string };
  toggles?: PubToggle[];
  persistKey?: string;
}

/** Build the replay stamp (query + toggles + persistKey) for a public
 *  time-chart. The chart opens at the auto fold over the full span (windowDays
 *  null) and navigates by click-to-drill + the level toggle — no window slider.
 *  windowDays/asOf are echoed (the client owns the window); atoms stay full-span.
 *  Shared by both composers so the shape can't drift. */
function replayStamp(kind: string, tenantId: number, q: CatalogQuery) {
  const windowDays = q.windowDays ?? null;
  const foldUnit = q.foldUnit ?? null;
  return {
    query: { kind, tenantId: String(tenantId), windowDays, ...(q.asOf ? { asOf: q.asOf } : {}), ...(foldUnit ? { foldUnit } : {}), ...(q.periodKey ? { periodKey: q.periodKey } : {}) },
    toggles: [pubGranularityToggle(foldUnit)],
    persistKey: `tenant:${tenantId}:${kind}`,
  };
}

/** publications.cadence — papers per period by work-type, as a time-series.
 *  Scope-narrowed via ctx: tenant-public ctx → tenant-wide, researcher ctx →
 *  that author's papers. One composer, both surfaces.
 *
 *  `query` present (public recompose) → stamp replay fields so the chart gets
 *  the window slider + drill. Absent (scoped dashboard via StatComposer) →
 *  bare directive, unchanged — the scoped dashboard has no slider. */
export async function composeCadence(ctx: ActorContext, query?: CatalogQuery): Promise<TimeChartDirective | null> {
  const { atoms, series, meanPerYear } = await cadenceLib.buildCadenceAtoms(scopeOf(ctx));
  if (!atoms.length || !series.length) return null;
  return {
    type: "stacked-bar",
    title: "Publication cadence",
    xLabel: "Year",
    yLabel: "Papers",
    series,
    aggregator: "sum",
    atoms,
    data: [],
    thresholds: [{ value: meanPerYear, label: meanPerYear.toFixed(1), color: "var(--fg-dim)" }],
    // Headline = mean papers/year, DERIVED from the plotted buckets so it
    // tracks window/fold (cosmetic reduction, not a hand-typed figure).
    kpi: { caption: "papers / year (avg)", reduce: "mean" },
    ...(query ? replayStamp("publications.cadence", ctx.tenantId, query) : {}),
  };
}

/** publications.byIndex — papers per period by indexation source, time-series.
 *  Scope-narrowed via ctx (unitKey → one faculty/department), like cadence.
 *  Replayable: stamps the window slider + drill from the wire query. */
export async function composeByIndex(ctx: ActorContext, query?: CatalogQuery): Promise<TimeChartDirective | null> {
  const tenantId = ctx.tenantId;
  const q = query ?? ({ tenantId: String(tenantId) } as CatalogQuery);
  const { atoms, series } = await indexLib.buildIndexationAtoms(scopeOf(ctx));
  if (!atoms.length || !series.length) return null;
  return {
    type: "stacked-bar",
    title: "Publicaciones por año",
    xLabel: "Año",
    yLabel: "Artículos",
    series,
    aggregator: "sum",
    atoms,
    data: [],
    ...replayStamp("publications.byIndex", tenantId, q),
  };
}

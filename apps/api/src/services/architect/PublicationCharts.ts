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

// The read scope the N4 libs consume — a subset of ActorContext (DGA scope model:
// ctx IS the read scope; personal scope narrows to the actor's own papers).
type Scope = Pick<ActorContext, "tenantId" | "orcid" | "ror" | "role">;
const scopeOf = (ctx: ActorContext): Scope =>
  ({ tenantId: ctx.tenantId, orcid: ctx.orcid ?? null, ror: ctx.ror ?? null, role: ctx.role });

// N4 data libs (CJS) — raw SQL + day/type aggregation only.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cadenceLib = require("../../lib/public-cadence-atoms") as {
  buildCadenceAtoms: (scope: Scope) => Promise<{ atoms: unknown[]; series: string[]; meanPerYear: number }>;
};
// eslint-disable-next-line @typescript-eslint/no-var-requires
const indexLib = require("../../lib/public-stats-atoms") as {
  buildIndexationAtoms: (tenantId: number) => Promise<{ atoms: unknown[]; series: string[] }>;
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
}

/** publications.cadence — papers per period by work-type, as a time-series.
 *  Scope-narrowed via ctx: tenant-public ctx → tenant-wide, researcher ctx →
 *  that author's papers. One composer, both surfaces. */
export async function composeCadence(ctx: ActorContext): Promise<TimeChartDirective | null> {
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
  };
}

/** publications.byIndex — papers per period by indexation source, time-series. */
export async function composeByIndex(tenantId: number): Promise<TimeChartDirective | null> {
  const { atoms, series } = await indexLib.buildIndexationAtoms(tenantId);
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
  };
}

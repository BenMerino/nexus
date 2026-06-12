const { buildKpiSparks, citesByYear, withProjection } = require("../../lib/public-kpi-sparks");
const { computeVelocity, buildVelocitySeries } = require("../../lib/portfolio-velocity");

/* ── PublicSeriesCharts (Composer) ──────────────────────────
 * Server-side composers for the public tenant page's PER-YEAR SERIES charts:
 * the KPI sparklines and citation velocity. Split from PublicCategoryCharts to
 * stay under the N5 line cap. Both reuse the citations/projection methodology in
 * lib/public-kpi-sparks (one source of truth), are unit-scoped via
 * resolvePubFilter, and registered as catalog kinds in AnalyticsCatalog.
 * ──────────────────────────────────────────────────────────── */

// A tenant-public scope: tenantId only, no orcid → tenant-wide; a unitKey
// narrows to one org unit (resolvePubFilter applies it in the data lib).
const publicScope = (tenantId: number, unitKey?: string | null) =>
  ({ tenantId, orcid: null, ror: null, role: "public", unitKey: unitKey ?? null });

/** KPI-sparks directive — per-year series behind the public KPI cards. PLAIN
 *  data (no atoms/query/toggles) by construction, so the card renders it with a
 *  tiny static SVG: NOT the engine, no slider, no fold — a lightweight glyph. */
export interface KpiSparkPoint { year: number; value: number; status: "observed" | "partial" | "projected"; }
export interface KpiSparksDirective {
  type: "kpi-sparks";
  series: { publications: KpiSparkPoint[]; citations: KpiSparkPoint[]; authors: KpiSparkPoint[]; oa: KpiSparkPoint[] };
}

/** publications.kpiSparks — per-year series behind the public KPI cards
 *  (publications / citations / authors). Unit-scoped via resolvePubFilter in the
 *  data lib, so the sparklines re-narrow with ?unit= exactly like the KPI
 *  numbers. Returns plain series (no atoms/query/toggles) → the card draws a
 *  static micro-SVG, never the interactive engine. */
export async function composeKpiSparks(tenantId: number, unitKey?: string | null): Promise<KpiSparksDirective | null> {
  const series = await buildKpiSparks(publicScope(tenantId, unitKey));
  const any = series.publications.length || series.citations.length || series.authors.length || series.oa.length;
  if (!any) return null;
  return { type: "kpi-sparks", series };
}

/** Velocity directive — citations-per-year as an area line with a forecast tail
 *  and the authoritative `score` KPI. Server-composed (the panel renders it via
 *  <RecomposeChart>, never shapes it). */
interface VelocityPoint { label: string; value: number; status: "observed" | "partial" | "projected"; }
export interface VelocityDirective {
  type: "area"; title: string; xLabel: string; yLabel: string; valueLabels: true;
  kpi: { caption: string; figure: string; trend: { direction: "rising" | "flat" | "falling"; label: string } };
  data: VelocityPoint[];
}

const TREND_LABEL = { rising: "rising", flat: "flat", falling: "falling" } as const;

/** publications.velocity — citation velocity. REUSES the citations-per-year +
 *  projection logic that backs the KPI sparkline (citesByYear/withProjection) so
 *  there is one methodology, and computeVelocity for the authoritative score.
 *  The partial (current) year plots its annualized run-rate so the line stays
 *  continuous (no false dip); observed solid, partial+projected dashed (the
 *  engine's status→style); 'area' fills a gradient underneath. */
export async function composeVelocity(tenantId: number, unitKey?: string | null): Promise<VelocityDirective | null> {
  return velocityFromScope(publicScope(tenantId, unitKey));
}

/** The scope-driven core, shared by the public kind (tenant/unit scope) and the
 *  scoped dashboard kind (orcid scope via StatComposer). `scope` flows through
 *  citesByYear → resolvePubFilter, so personal/tenant/unit narrowing all work. */
export async function velocityFromScope(scope: { tenantId: number; orcid: string | null; ror: string | null; role?: string; unitKey: string | null }): Promise<VelocityDirective | null> {
  const raw: Array<{ year: number; value: number }> = await citesByYear(scope);
  if (!raw.length) return null;
  const currentYear = new Date().getUTCFullYear();
  const series: Array<{ year: number; value: number; status: VelocityPoint["status"] }> = withProjection(raw, currentYear);

  // Annualize the partial year so the line doesn't dip into the incomplete year.
  const fraction = Math.max(0.05, (Date.now() - Date.UTC(currentYear, 0, 1)) / (365.25 * 86_400_000));
  const data: VelocityPoint[] = series.map((p) => ({
    label: String(p.year),
    value: p.status === "partial" ? Math.round(p.value / fraction) : p.value,
    status: p.status,
  }));

  // Authoritative score + trend from the established velocity methodology
  // (computeVelocity weights the last 3 years; buildVelocitySeries classifies
  // the trend from the regression slope). Reused, not re-derived.
  const byYear = new Map(raw.map((r) => [r.year, r.value]));
  const score = computeVelocity(byYear, currentYear);
  const direction: "rising" | "flat" | "falling" = buildVelocitySeries(byYear, currentYear, new Date()).trend;
  return {
    type: "area", title: "Citation velocity", xLabel: "Year", yLabel: "Citations", valueLabels: true,
    kpi: {
      caption: "score",
      figure: score.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      trend: { direction, label: TREND_LABEL[direction] },
    },
    data,
  };
}

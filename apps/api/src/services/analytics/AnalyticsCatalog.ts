import { composeCadence, composeByIndex } from "../architect/PublicationCharts";
import { composeTopJournals, composeCollaborators, composeCountriesMap, composeResearchAreas } from "../architect/PublicCategoryCharts";
import { composeKpiSparks, composeVelocity } from "../architect/PublicSeriesCharts";
import type { AnalyticsMetric } from "./analytics-catalog.types";
import { replay, publicCtx } from "./catalog-compose-ctx";

export type { AnalyticsMetric, AnalyticsSurface } from "./analytics-catalog.types";

/* ── AnalyticsCatalog ───────────────────────────────────────
 * Single source of truth for "what metrics can this platform graph?"
 *
 * Each entry is one row of the catalog that previously lived scattered across
 * recompose-registry's PUBLIC_KINDS map and StatComposer's COMPOSERS map.
 * Collapsing those into one manifest makes adding a chart a one-entry change:
 * the recompose registry is GENERATED from this array, so no kind can exist
 * outside it and no monolithic stat blob can re-form.
 *
 * The catalog stays a manifest, not a Logic file — compose functions live in
 * their domain homes (PublicationCharts, StatComposer); this file references
 * them. `legacyReplay` resolves the compiled JS replay composer at runtime
 * (architect-replay.js predates the TS migration).
 *
 * Ordered: `overview`-surfaced rows render in this order.
 * ──────────────────────────────────────────────────────────── */

export const ANALYTICS_METRICS: readonly AnalyticsMetric[] = [
  {
    kind: "publications",
    domain: "publication",
    title: "Publications by Year",
    description: "Per-day publication counts as a replayable timeline (window slider).",
    queryShape: "range",
    access: "public",
    compose: (q) => replay.recompose(q),
    invalidatedBy: ["publication.upserted", "ingestion.completed"],
    surfaces: ["overview"],
  },
  {
    kind: "publications.cadence",
    domain: "publication",
    title: "Publication Cadence",
    description: "Papers per period by work-type, as per-day atoms folded at render.",
    queryShape: "range",
    access: "public",
    compose: async (q) => composeCadence(await publicCtx(q), q),
    invalidatedBy: ["publication.upserted", "ingestion.completed"],
    surfaces: ["overview"],
  },
  {
    kind: "publications.byIndex",
    domain: "publication",
    title: "Publicaciones por año (indexed)",
    description: "Per-day publication counts stacked by index source (WoS/Scopus/SciELO/DOAJ).",
    queryShape: "range",
    access: "public",
    compose: async (q) => composeByIndex(await publicCtx(q), q),
    invalidatedBy: ["publication.upserted", "ingestion.completed", "venue.indexationUpdated"],
    surfaces: ["overview"],
  },
  {
    kind: "publications.topJournals",
    domain: "publication",
    title: "Principales revistas",
    description: "Top journals by publication count (ranked bar).",
    queryShape: "none",
    access: "public",
    compose: (q) => composeTopJournals(parseInt(q.tenantId, 10), q.unit),
    invalidatedBy: ["publication.upserted", "ingestion.completed"],
    surfaces: ["overview"],
  },
  {
    kind: "publications.collaborators",
    domain: "publication",
    title: "Principales instituciones colaboradoras",
    description: "Top collaborating institutions by co-authored paper count (ranked bar).",
    queryShape: "none",
    access: "public",
    compose: (q) => composeCollaborators(parseInt(q.tenantId, 10), q.unit),
    invalidatedBy: ["publication.upserted", "ingestion.completed"],
    surfaces: ["overview"],
  },
  {
    kind: "publications.researchAreas",
    domain: "publication",
    title: "Research areas",
    description: "Top OpenAlex concepts on the corpus by distinct publication count (ranked bar).",
    queryShape: "none",
    access: "public",
    compose: (q) => composeResearchAreas(parseInt(q.tenantId, 10), q.unit),
    invalidatedBy: ["publication.upserted", "ingestion.completed"],
    surfaces: ["overview"],
  },
  {
    kind: "publications.countriesMap",
    domain: "publication",
    title: "Contribuciones por país",
    description: "Country contributions as a world choropleth — distinct publications with a co-author affiliated in each country.",
    queryShape: "none",
    access: "public",
    compose: (q) => composeCountriesMap(parseInt(q.tenantId, 10), q.unit),
    invalidatedBy: ["publication.upserted", "ingestion.completed"],
    surfaces: ["overview"],
  },
  {
    kind: "publications.velocity",
    domain: "publication",
    title: "Citation velocity",
    description: "Citations received per year as an area line with a forecast tail + velocity score.",
    queryShape: "none",
    access: "public",
    compose: (q) => composeVelocity(parseInt(q.tenantId, 10), q.unit),
    invalidatedBy: ["publication.upserted", "ingestion.completed"],
    surfaces: ["overview"],
  },
  {
    kind: "publications.kpiSparks",
    domain: "publication",
    title: "KPI sparklines",
    description: "Per-year series (publications/citations/authors) behind the public KPI cards.",
    queryShape: "none",
    access: "public",
    compose: (q) => composeKpiSparks(parseInt(q.tenantId, 10), q.unit),
    invalidatedBy: ["publication.upserted", "ingestion.completed"],
    surfaces: ["overview"],
  },
];

/** Lookup one metric by kind. */
export function getMetric(kind: string): AnalyticsMetric | undefined {
  return ANALYTICS_METRICS.find((m) => m.kind === kind);
}

import { composeCadence, composeByIndex } from "../architect/PublicationCharts";
import { composeTopJournals, composeCollaborators, composeCountries, composeCountriesMap, composeTypeByYear } from "../architect/PublicCategoryCharts";
import type { ActorContext } from "../../substrate/actor";
import type { AnalyticsMetric, CatalogQuery } from "./analytics-catalog.types";

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

// architect-replay is legacy JS in lib/; the whole app compiles to dist/ 1:1,
// so this require resolves to the compiled sibling at runtime (tsconfig allowJs).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const replay = require("../../lib/architect-replay") as {
  recompose: (query: CatalogQuery) => Promise<unknown>;
};

// A tenant-public ActorContext from a wire query: tenantId only, no orcid →
// the composer's scope filter narrows to the whole tenant (not a person), or to
// one org unit when the query carries a drill-down `unit` key. Single fan-out
// point: every public metric flows through here, so all charts inherit unit scope.
const publicCtx = (q: CatalogQuery): ActorContext =>
  ({ tenantId: parseInt(q.tenantId, 10), orcid: null, ror: null, role: "public", unitKey: q.unit ?? null } as unknown as ActorContext);

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
    compose: (q) => composeCadence(publicCtx(q), q),
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
    compose: (q) => composeByIndex(publicCtx(q), q),
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
    kind: "publications.countries",
    domain: "publication",
    title: "Contribuciones por país",
    description: "Country contributions — distinct publications with a co-author affiliated in each country (donut).",
    queryShape: "none",
    access: "public",
    compose: (q) => composeCountries(parseInt(q.tenantId, 10), q.unit),
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
    kind: "publications.typeByYear",
    domain: "publication",
    title: "Publicaciones por tipo",
    description: "Work-type × year heatmap (top 6 types).",
    queryShape: "none",
    access: "public",
    compose: (q) => composeTypeByYear(parseInt(q.tenantId, 10)),
    invalidatedBy: ["publication.upserted", "ingestion.completed"],
    surfaces: ["overview"],
  },
];

/** Lookup one metric by kind. */
export function getMetric(kind: string): AnalyticsMetric | undefined {
  return ANALYTICS_METRICS.find((m) => m.kind === kind);
}

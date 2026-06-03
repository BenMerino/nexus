import { getTopJournals, getTypeByYear, getPublicationTypes } from "../../lib/public-stats";
const { getCollaborations, getCountries } = require("../../lib/dashboard-stats");

/* ── PublicCategoryCharts (Composer) ────────────────────────
 * Server-side composers for the public tenant page's CATEGORICAL charts
 * (ranked bars / donuts) — the data-shaping that previously lived in the
 * browser's buildTenantCharts. Each returns the directive the engine renders;
 * the client only `<RecomposeChart kind=...>`s, never shapes `data`.
 *
 * Categorical (not time-series): they ship pre-aggregated `data` rows from a
 * SQL GROUP BY, no atoms. Tenant-wide reads (public access), so they take a
 * tenantId, not a scope ctx. Registered as catalog kinds in AnalyticsCatalog.
 * ──────────────────────────────────────────────────────────── */

/** Minimal server-emitted categorical directive (the contract GraphRender reads). */
export interface CategoryDirective {
  type: "bar" | "donut";
  title: string;
  xLabel?: string;
  yLabel?: string;
  data: { label: string; value: number }[];
}

/** Heatmap directive — row/col cells (type × year). */
export interface HeatmapDirective {
  type: "heatmap";
  title: string;
  xLabel: string;
  yLabel: string;
  data: { row: string; col: string; value: number; label: string }[];
}

/** publications.topJournals — top journals by paper count (ranked bar).
 *  Reuses getTopJournals' entity-model SQL (venues + published_in, one row per
 *  journal, distinct publications). Full names: the engine ellipsizes/decimates
 *  labels at render, so the composer never truncates (which would collide). */
export async function composeTopJournals(tenantId: number): Promise<CategoryDirective | null> {
  const rows = await getTopJournals(tenantId);
  if (!rows.length) return null;
  return {
    type: "bar",
    title: "Principales revistas",
    xLabel: "Revista",
    yLabel: "Artículos",
    data: rows.map((j) => ({ label: j.journal || "", value: j.count })),
  };
}

// A tenant-public scope: tenantId only, no orcid → scopedPubFilter narrows to
// the whole tenant (the public page's read scope).
const publicScope = (tenantId: number) => ({ tenantId, orcid: null, ror: null, role: "public" });

/** publications.collaborators — top collaborating institutions (ranked bar). */
export async function composeCollaborators(tenantId: number): Promise<CategoryDirective | null> {
  const rows: Array<{ value: string; count: string | number }> = await getCollaborations(publicScope(tenantId));
  if (!rows.length) return null;
  return {
    type: "bar",
    title: "Principales instituciones colaboradoras",
    xLabel: "Institución",
    yLabel: "Artículos en colaboración",
    data: rows.slice(0, 15).map((c) => ({ label: c.value || "", value: Number(c.count) })),
  };
}

/** publications.countries — publications by author-affiliation country (donut). */
export async function composeCountries(tenantId: number): Promise<CategoryDirective | null> {
  const rows: Array<{ country: string; count: number }> = await getCountries(publicScope(tenantId));
  if (!rows.length) return null;
  return {
    type: "donut",
    title: "Publicaciones por país",
    data: rows.slice(0, 12).map((c) => ({ label: c.country, value: Number(c.count) })),
  };
}

/** publications.typeByYear — work-type × year heatmap (top 6 types). Ports the
 *  client buildTypeChart's slice/filter/map to the server. */
export async function composeTypeByYear(tenantId: number): Promise<HeatmapDirective | null> {
  const [types, typeByYear] = await Promise.all([getPublicationTypes(tenantId), getTypeByYear(tenantId)]);
  if (!typeByYear.length) return null;
  const top = new Set(types.slice(0, 6).map((t) => t.type));
  const cells = typeByYear
    .filter((r) => top.has(r.type) && r.year)
    .map((r) => ({ row: r.type, col: r.year, value: r.count, label: `${r.type} ${r.year}` }));
  if (!cells.length) return null;
  return { type: "heatmap", title: "Publicaciones por tipo", xLabel: "Año", yLabel: "Tipo", data: cells };
}

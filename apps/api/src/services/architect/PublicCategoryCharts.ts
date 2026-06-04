import { getTypeByYear, getPublicationTypes } from "../../lib/public-stats";
const { getCollaborations, getCountries, getTopJournals } = require("../../lib/dashboard-stats");
const { getTenantRor } = require("../../lib/db-users");

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
export async function composeTopJournals(tenantId: number, unitKey?: string | null): Promise<CategoryDirective | null> {
  // dashboard-stats.getTopJournals honors org-unit scope via resolvePubFilter
  // (rows: {value: name, key: id, count}); the public-stats variant was
  // tenant-only. Same entity-model SQL, now unit-aware.
  const rows: Array<{ value: string; count: string | number }> = await getTopJournals(publicScope(tenantId, unitKey));
  if (!rows.length) return null;
  return {
    type: "bar",
    title: "Principales revistas",
    xLabel: "Revista",
    yLabel: "Artículos",
    data: rows.map((j) => ({ label: j.value || "", value: Number(j.count) })),
  };
}

// A tenant-public scope: tenantId only, no orcid → scopedPubFilter narrows to
// the whole tenant (the public page's read scope). An optional unitKey narrows
// further to one org unit (resolvePubFilter applies it in the stats readers).
const publicScope = (tenantId: number, unitKey?: string | null) =>
  ({ tenantId, orcid: null, ror: null, role: "public", unitKey: unitKey ?? null });

/** publications.collaborators — top collaborating institutions (ranked bar).
 *  Passes the tenant's home ROR so getCollaborations excludes the tenant from
 *  its own collaborators list (a tenant isn't its own collaborator). */
export async function composeCollaborators(tenantId: number, unitKey?: string | null): Promise<CategoryDirective | null> {
  const ror: string | null = await getTenantRor(tenantId);
  const rows: Array<{ value: string; count: string | number }> = await getCollaborations({ ...publicScope(tenantId, unitKey), ror });
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
export async function composeCountries(tenantId: number, unitKey?: string | null): Promise<CategoryDirective | null> {
  const rows: Array<{ country: string; count: number }> = await getCountries(publicScope(tenantId, unitKey));
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

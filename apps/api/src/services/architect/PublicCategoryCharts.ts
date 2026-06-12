const { getCollaborations, getCountries, getTopJournals } = require("../../lib/dashboard-stats");
const { getResearchAreas } = require("../../lib/concept-stats");
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

// Ranked "top" bar charts (journals, collaborators) show only the leaders.
export const TOP_N = 10;

/** Minimal server-emitted categorical directive (the contract GraphRender reads). */
export interface CategoryDirective {
  type: "bar" | "donut";
  title: string;
  xLabel?: string;
  yLabel?: string;
  data: { label: string; value: number }[];
}

/** Choropleth directive — countries shaded by value. `country` is ISO-alpha2;
 *  the engine's geo family resolves names/geometry from the host geo asset, so
 *  the composer ships data-only (no rings). */
export interface ChoroplethDirective {
  type: "choropleth";
  title: string;
  data: { country: string; value: number }[];
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
    data: rows.slice(0, TOP_N).map((j) => ({ label: j.value || "", value: Number(j.count) })),
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
    data: rows.slice(0, TOP_N).map((c) => ({ label: c.value || "", value: Number(c.count) })),
  };
}

/** publications.researchAreas — top OpenAlex concepts on the corpus (ranked
 *  bar). The institutional "what do we research" panel; counts distinct
 *  publications per concept, unit-scoped like the other categorical kinds. */
export async function composeResearchAreas(tenantId: number, unitKey?: string | null): Promise<CategoryDirective | null> {
  const rows: Array<{ name: string; count: number }> = await getResearchAreas(publicScope(tenantId, unitKey));
  if (!rows.length) return null;
  return {
    type: "bar",
    title: "Research areas",
    xLabel: "Concept",
    yLabel: "Publications",
    data: rows.map((c) => ({ label: c.name || "", value: Number(c.count) })),
  };
}

/** publications.countriesMap — publications by author-affiliation country as a
 *  world choropleth. Same reader as the donut (country = ISO-alpha2, the engine
 *  geo family shades by value); ships full distribution (no top-N slice) so the
 *  whole map can shade. */
export async function composeCountriesMap(tenantId: number, unitKey?: string | null): Promise<ChoroplethDirective | null> {
  const rows: Array<{ country: string; count: number }> = await getCountries(publicScope(tenantId, unitKey));
  if (!rows.length) return null;
  return {
    type: "choropleth",
    // "Contribuciones", not "Publicaciones": the count is distinct pubs with a
    // co-author affiliated in each country, so a cross-country paper counts for
    // each — per-country totals sum above the publication total. It measures
    // each country's CONTRIBUTION/involvement, not a partition of the corpus.
    title: "Top collaborating countries",
    data: rows.map((c) => ({ country: c.country, value: Number(c.count) })),
  };
}


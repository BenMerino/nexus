/* ── Statistician resolver manifest ────────────────────────────
 * Declarative descriptors for the Statistician's reads, auto-discovered by the
 * resolver-scanner at bootstrap (file name ends ResolverTools). Each entry wires
 * a read to the resolver registry (and, later, the chart Composer / any
 * automation surface) with its RBAC + chartable/tableable hints. executeWithCtx
 * receives the ActorContext built by the handler gate.
 * ──────────────────────────────────────────────────────────── */

import type { ResolverManifest } from "../resolvers/resolver.types";
import { statistician } from "./Statistician";

export const resolverTools: ResolverManifest[] = [
  {
    name: "dashboard_summary",
    description: "Tenant/personal bibliometric summary: total publications, citations, OA count, distinct authors.",
    requires: ["publication", "author"],
    inputSchema: { properties: {}, required: [] },
    rbacPermission: "read:stats",
    executeWithCtx: (_input, ctx) => statistician.summary(ctx),
    tableable: true,
  },
  {
    name: "publications_by_year",
    description: "Publication counts per year (chartable bar series).",
    requires: ["publication"],
    inputSchema: { properties: {}, required: [] },
    rbacPermission: "read:stats",
    executeWithCtx: (_input, ctx) => statistician.byYear(ctx),
    chartable: true,
  },
  {
    name: "top_journals",
    description: "Top venues by publication count (venue_type=journal), chartable.",
    requires: ["venue", "publication"],
    inputSchema: { properties: {}, required: [] },
    rbacPermission: "read:stats",
    executeWithCtx: (_input, ctx) => statistician.topJournals(ctx),
    chartable: true,
  },
  {
    name: "collaborating_institutions",
    description: "Top collaborating institutions by shared-publication count, chartable.",
    requires: ["institution", "publication"],
    inputSchema: { properties: {}, required: [] },
    rbacPermission: "read:stats",
    executeWithCtx: (_input, ctx) => statistician.collaborations(ctx),
    chartable: true,
  },
  {
    name: "researcher_collaborators",
    description: "Suggested collaborators for a researcher by shared research concepts (excludes existing co-authors).",
    requires: ["author", "publication"],
    inputSchema: { properties: { orcid: { type: "string" }, limit: { type: "number" } }, required: ["orcid"] },
    rbacPermission: "read:stats",
    executeWithCtx: (input, ctx) => statistician.collaborators(ctx, input.orcid, input.limit ?? 10),
    tableable: true,
  },
];

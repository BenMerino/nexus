/* ── Claustro resolver manifest ────────────────────────────────
 * Declarative descriptors for the Claustro resolver's reads, auto-discovered by
 * the resolver-scanner at bootstrap (file name ends ResolverTools). Mirrors the
 * /api/claustro GET actions (list / validate / validate-all / indices).
 * executeWithCtx receives the ActorContext built by the handler gate.
 * ──────────────────────────────────────────────────────────── */

import type { ResolverManifest } from "../resolvers/resolver.types";
import { claustroResolver, PROGRAMS } from "./Claustro";

export const resolverTools: ResolverManifest[] = [
  {
    name: "claustro_list",
    description: "Tenant faculty (claustro) classification: each active academic scored against the graduate-program criteria.",
    requires: ["project", "publication"],
    inputSchema: { properties: {}, required: [] },
    rbacPermission: "read:claustro",
    executeWithCtx: (_input, ctx) => claustroResolver.list(ctx),
    tableable: true,
  },
  {
    name: "claustro_validate_all",
    description: "Validate all three CNA graduate programs against the claustro thresholds (qualified count, avg hours, percent qualified).",
    requires: ["project", "publication"],
    inputSchema: { properties: {}, required: [] },
    rbacPermission: "read:claustro",
    executeWithCtx: (_input, ctx) => claustroResolver.validateAll(ctx),
    tableable: true,
  },
  {
    name: "claustro_validate_program",
    description: "Validate one CNA graduate program against the claustro thresholds.",
    requires: ["project", "publication"],
    inputSchema: { properties: { program: { type: "string", enum: [...PROGRAMS] } }, required: ["program"] },
    rbacPermission: "read:claustro",
    executeWithCtx: (input, ctx) => claustroResolver.validate(ctx, input.program),
  },
  {
    name: "accepted_indices",
    description: "The tenant's accepted citation indices (WoS/Scopus/SciELO/…) that count as 'qualified' for the classification.",
    requires: ["project"],
    inputSchema: { properties: {}, required: [] },
    rbacPermission: "read:claustro",
    executeWithCtx: (_input, ctx) => claustroResolver.acceptedIndices(ctx),
    tableable: true,
  },
];

/* ── Assessor resolver manifest ────────────────────────────────
 * Auto-discovered by the resolver-scanner (file name ends ResolverTools). Exposes
 * the lifecycle assessment as a read tool: assess the acting tenant's data state
 * and return the previewable plan. executeWithCtx gets the gated ActorContext.
 * ──────────────────────────────────────────────────────────── */

import type { ResolverManifest } from "../resolvers/resolver.types";
import { assessor } from "./Assessor";

export const resolverTools: ResolverManifest[] = [
  {
    name: "lifecycle_assess",
    description: "Assess a tenant's data lifecycle state → a plan of recommended actions (resolve ORCIDs, initial load, refresh stale, review duplicate institutions), each with a reason. Read-only preview.",
    requires: ["author", "publication", "institution"],
    inputSchema: { properties: {}, required: [] },
    rbacPermission: "read:lifecycle",
    executeWithCtx: (_input, ctx) => assessor.assess(ctx),
    tableable: true,
  },
];

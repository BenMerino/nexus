import type { ActorContext } from "../../substrate/actor";
import type { CatalogQuery } from "./analytics-catalog.types";

/* Compose-context helpers for the AnalyticsCatalog manifest: the tenant-public
 * ActorContext builder every public metric fans out through, and the legacy
 * replay bridge. Split out so AnalyticsCatalog stays a pure manifest under the
 * N5 line cap. */

// architect-replay is legacy JS in lib/; the whole app compiles to dist/ 1:1,
// so this require resolves to the compiled sibling at runtime (tsconfig allowJs).
// eslint-disable-next-line @typescript-eslint/no-var-requires
export const replay = require("../../lib/architect-replay") as {
  recompose: (query: CatalogQuery) => Promise<unknown>;
};

// architect-replay's sibling lib resolves the tenant's home ROR — public scope
// shows only ROR-attributable papers (scopedPubFilter gates on the
// affiliated_with edge), so every public ctx must carry it, not null.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getTenantRor } = require("../../lib/db-users") as {
  getTenantRor: (id: number) => Promise<string | null>;
};

// A tenant-public ActorContext from a wire query: no orcid → the composer's
// scope filter narrows to the whole tenant (not a person), gated to the tenant's
// ROR for public reads, or to one org unit when the query carries a drill-down
// `unit` key. Async because it resolves the home ROR. Single fan-out point:
// every public metric flows through here, so all charts inherit ROR + unit scope.
export const publicCtx = async (q: CatalogQuery): Promise<ActorContext> => {
  const tenantId = parseInt(q.tenantId, 10);
  const ror = await getTenantRor(tenantId);
  return ({ tenantId, orcid: null, ror, role: "public", unitKey: q.unit ?? null } as unknown as ActorContext);
};

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

// A tenant-public ActorContext from a wire query: tenantId only, no orcid →
// the composer's scope filter narrows to the whole tenant (not a person), or to
// one org unit when the query carries a drill-down `unit` key. Single fan-out
// point: every public metric flows through here, so all charts inherit unit scope.
export const publicCtx = (q: CatalogQuery): ActorContext =>
  ({ tenantId: parseInt(q.tenantId, 10), orcid: null, ror: null, role: "public", unitKey: q.unit ?? null } as unknown as ActorContext);

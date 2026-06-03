/* ── DGA Bootstrap ─────────────────────────────────────────────
 * Wires the Deterministic Governor Architecture into the running
 * process. Called once from index.js during startServer(), AFTER
 * handlers mount and BEFORE app.listen. Order matters (Zincro contract):
 *   1. configure BaseGovernor with the audit ledger port
 *   2. scan action manifests (write tools)
 *   3. load conversation-bindings (entity registry) — before resolvers,
 *      since resolver tools may enumerate it
 *   4. scan resolver manifests (read tools)
 * Today every registry is empty, so this is a logged no-op — the seam
 * exists so domains light up by merely shipping their *Actions/*ResolverTools.
 * ──────────────────────────────────────────────────────────── */

import { BaseGovernor } from "./BaseGovernor";
import { auditLedger } from "./AuditLedger";
import { scanActions } from "./actions/action-scanner";
import { scanResolvers } from "./resolvers/resolver-scanner";
import { directiveCache } from "./architect/DirectiveCache";

export function bootstrap(): void {
  BaseGovernor.configure({ ledger: auditLedger });
  scanActions();
  require("./conversation-bindings"); // side-effect: domains self-register
  scanResolvers();
  // Wire the analytics directive cache's invalidatedBy hooks (in-process
  // events). Independent of the WS layer, so the HTTP recompose path gets
  // compute-once caching even when /api/stream is down. The cross-process
  // path (worker ingestion → outbox) is wired in StreamInvalidationListener.
  directiveCache.wireInvalidation();
  console.log("[bootstrap] DGA wired (ledger + scanners + directive cache)");
}

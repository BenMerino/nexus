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

export function bootstrap(): void {
  BaseGovernor.configure({ ledger: auditLedger });
  scanActions();
  require("./conversation-bindings"); // side-effect: domains self-register
  scanResolvers();
  console.log("[bootstrap] DGA wired (ledger + scanners)");
}

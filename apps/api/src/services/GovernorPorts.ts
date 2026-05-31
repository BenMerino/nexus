/* ── Governor Ports ────────────────────────────────────────────
 * Outbound interfaces a Governor depends on, injected at bootstrap so
 * the base class stays free of concrete wiring. Port of Zincro's
 * GovernorPorts. Today there is one port (audit); add more here as the
 * DGA grows (e.g. a clock or id-gen port for deterministic tests).
 * ──────────────────────────────────────────────────────────── */

/** The audit ledger sink. `AuditLedger` (Phase 2) is the concrete impl,
 *  wired via `BaseGovernor.configure({ ledger })` in bootstrap. */
export interface AuditPort {
  appendLog(
    tenantId: number,
    entityId: string,
    action: string,
    userId: string,
  ): Promise<void>;
}

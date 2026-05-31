/* ── AuditLedger ───────────────────────────────────────────────
 * The concrete AuditPort: appends one row to `audit_log` per governor
 * write. Wired into BaseGovernor at bootstrap via
 * `BaseGovernor.configure({ ledger: auditLedger })` (Phase 3).
 *
 * Writes inside `withTenant` so the row is tenant-scoped (and RLS-ready).
 * A failed audit write must not crash the governor's own (already
 * committed) write — callers invoke this best-effort.
 * ──────────────────────────────────────────────────────────── */

import type { PoolClient } from "pg";
import type { AuditPort } from "./GovernorPorts";
import { withTenant } from "../db/index";

class AuditLedger implements AuditPort {
  async appendLog(
    tenantId: number,
    entityId: string,
    action: string,
    userId: string,
  ): Promise<void> {
    await withTenant(tenantId, async (client: PoolClient) => {
      await client.query(
        `INSERT INTO audit_log (tenant_id, entity_id, action, user_id)
         VALUES ($1, $2, $3, $4)`,
        [tenantId, entityId, action, userId],
      );
    });
  }
}

export const auditLedger = new AuditLedger();

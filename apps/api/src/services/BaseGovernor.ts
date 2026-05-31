/* ── BaseGovernor ──────────────────────────────────────────────
 * Abstract foundation for every Deterministic Governor. Provides typed
 * event emission and audit-ledger logging. Port of Zincro's BaseGovernor.
 *
 * Contract (see role-contracts.ts): a Governor is the SOLE writer for its
 * aggregate, validates then writes inside a single `withTenant` tx, and
 * emits its `domain.action` event AFTER the tx commits (so consumers never
 * observe uncommitted state). Governors never call other Governors —
 * Workflows orchestrate across them.
 *
 * Call `BaseGovernor.configure({ ledger })` ONCE at bootstrap, before any
 * governor emits or logs.
 * ──────────────────────────────────────────────────────────── */

import { eventBus, type GovernorEventMap, type GovernorEvent } from "./EventBus";
import type { AuditPort } from "./GovernorPorts";

export abstract class BaseGovernor {
  private static ledger: AuditPort | null = null;

  /** One-time bootstrap wiring. */
  static configure(ports: { ledger: AuditPort }): void {
    BaseGovernor.ledger = ports.ledger;
  }

  /** Typed event emission — compile-time safety on names + payloads. */
  protected emitEvent<K extends GovernorEvent>(
    event: K,
    payload: GovernorEventMap[K],
  ): void {
    eventBus.emit(event, payload);
  }

  /** Append an audit row via the injected port. No-op (warns) if the
   *  ledger hasn't been configured yet. */
  protected async logToLedger(
    tenantId: number,
    entityId: string,
    action: string,
    userId: string,
    context?: unknown,
  ): Promise<void> {
    if (!BaseGovernor.ledger) {
      console.warn(
        "[BaseGovernor] Ledger port not configured — call BaseGovernor.configure()",
      );
      return;
    }
    await BaseGovernor.ledger.appendLog(tenantId, entityId, action, userId);
    if (context) {
      console.log(`[Ledger] ${action} for ${entityId}:`, context);
    }
  }
}

/* ── Typed Governor EventBus ───────────────────────────────────
 * The single coordination seam between DGA roles. Governors emit
 * `domain.action` events after a write commits; Resolvers, Workflows,
 * and Dispatchers listen. Synchronous, in-process (one Node process) —
 * no network, no persistence. Port of Zincro's TypedEventBus.
 *
 * Adding a new event:
 *   1. Add `'domain.action': TenantPayload & { ... }` to GovernorEventMap.
 *   2. Emit via `this.emitEvent(...)` (BaseGovernor subclass) or
 *      `eventBus.emit(...)` (non-class helper), AFTER the tx commits.
 *   3. Listen via `eventBus.on('domain.action', handler)` in the consumer.
 *
 * Tenant ids are integers in Nexus; we carry them as `number` here.
 * ──────────────────────────────────────────────────────────── */

import { EventEmitter } from "events";

/** Every write event is tenant-scoped. */
export interface TenantPayload {
  tenantId: number;
}

/** Substrate-identity tail — who performed the act, for audit/decision
 *  consumers, without a callback. Optional during the migration window;
 *  present when the emitter went through a ctx-aware Governor method. */
export interface ActorIdentityTail {
  actorUserId?: string;
  actorKind?: string;
}

/** The typed event catalog. Seeded empty — each domain phase adds its
 *  own `domain.action` keys here as it lands. */
export interface GovernorEventMap {
  // Seeded empty; each domain phase adds its channels (see docs/DGA_DESIGN.md):
  //   publication.upserted | publication.deleted
  //   author.upserted | author.merged | author.claimed
  //   venue.upserted | venue.indexationUpdated
  //   institution.provisioned | institution.policyChanged
  //   project.created | project.updated | project.approved
  //   ingestion.completed | roster.imported
}

export type GovernorEvent = keyof GovernorEventMap;

class TypedEventBus {
  private emitter = new EventEmitter();

  emit<K extends GovernorEvent>(event: K, payload: GovernorEventMap[K]): void {
    console.log(`[EventBus] ${String(event)}:`, payload);
    this.emitter.emit(event as string, payload);
  }

  on<K extends GovernorEvent>(
    event: K,
    handler: (payload: GovernorEventMap[K]) => void,
  ): void {
    this.emitter.on(event as string, handler as (...args: any[]) => void);
  }

  off<K extends GovernorEvent>(
    event: K,
    handler: (payload: GovernorEventMap[K]) => void,
  ): void {
    this.emitter.off(event as string, handler as (...args: any[]) => void);
  }
}

export const eventBus = new TypedEventBus();

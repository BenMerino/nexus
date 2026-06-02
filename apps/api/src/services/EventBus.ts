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
const { enqueueEvent } = require("../lib/db-outbox");

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
  // Phase 4 — project domain (first migrated governor).
  "project.created": TenantPayload & { projectId: number } & ActorIdentityTail;
  "project.updated": TenantPayload & { projectId: number } & ActorIdentityTail;
  "project.deleted": TenantPayload & { projectId: number } & ActorIdentityTail;
  // Author domain — claim binds a substrate user (by ORCID) to a publication
  // as an authorship edge (the entity form of the legacy author-tag claim).
  "author.claimed": TenantPayload & { orcid: string; publicationId: number } & ActorIdentityTail;
  // Author merge — two author identities folded into one (entity resolution).
  "author.merged": TenantPayload & { fromId: number; intoId: number } & ActorIdentityTail;
  // Publication domain — a paper + its edges (authorship/published_in/affiliation)
  // upserted by PublicationGovernor (the ingestion write path's sole writer).
  "publication.upserted": TenantPayload & { publicationId: number; doi: string } & ActorIdentityTail;
  // Venue domain — indexation flags (in_wos/scopus/doaj/scielo) rebuilt from
  // the indexed_journals registry.
  "venue.indexationUpdated": TenantPayload & { updated: number } & ActorIdentityTail;
  // Institution domain — duplicate institution identities folded into one.
  "institution.merged": TenantPayload & { intoId?: number; variantsMerged: number } & ActorIdentityTail;
  // Ingestion — one DOI fetched/normalized/stored through the IngestionWorkflow.
  "ingestion.completed": TenantPayload & { publicationId: number; doi: string } & ActorIdentityTail;
  // Lifecycle — a tenant was provisioned (→ scheduler kicks its first refresh).
  "tenant.provisioned": TenantPayload & { ror: string | null } & ActorIdentityTail;
  // Lifecycle — a tenant's roster was imported (→ scheduler kicks a refresh).
  "roster.imported": TenantPayload & { added: number } & ActorIdentityTail;
  // Future domains add their channels here (see docs/DGA_DESIGN.md):
  //   publication.deleted | venue.upserted/merged
}

export type GovernorEvent = keyof GovernorEventMap;

class TypedEventBus {
  private emitter = new EventEmitter();
  /** When true, emit ALSO persists to the outbox + NOTIFYs (cross-process). The
   *  worker's OutboxRelay sets this false on itself: relayed events re-enter the
   *  worker's bus as IN-PROCESS only, so they don't loop back into the outbox. */
  private persist = true;

  setPersist(on: boolean): void {
    this.persist = on;
  }

  emit<K extends GovernorEvent>(event: K, payload: GovernorEventMap[K]): void {
    console.log(`[EventBus] ${String(event)}:`, payload);
    // In-process delivery (synchronous) — existing listeners, unchanged contract.
    this.emitter.emit(event as string, payload);
    // Durable cross-process delivery: enqueue to the outbox + NOTIFY. Fire-and-
    // forget on the pool (emit stays sync). The relay + scheduler tick are the
    // at-least-once safety net, so a dropped enqueue is recoverable, not fatal.
    if (this.persist) {
      const tenantId = (payload as TenantPayload).tenantId;
      Promise.resolve(enqueueEvent(null, tenantId, String(event), payload))
        .catch((err: Error) => console.warn(`[EventBus] outbox enqueue failed for ${String(event)}:`, err.message));
    }
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

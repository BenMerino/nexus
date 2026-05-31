/* ── Conversation Bindings ─────────────────────────────────────
 * The entity-kind registry for the (future) AI conversation surface:
 * each governable entity registers how to verify access to one of its
 * rows and how to summarize it. Imported for side effect at bootstrap
 * BEFORE the resolver scan (Zincro order — resolver tools may enumerate
 * the registry). Empty until domains register; the seam exists now.
 * ──────────────────────────────────────────────────────────── */

import type { ActorContext } from "../substrate/actor";

export interface EntityAccessResult {
  ok: boolean;
  status?: number;
  message?: string;
}

export interface EntityKind {
  /** Singular domain noun, matches the governor + entity-ref (publication, author, …). */
  kind: string;
  /** Can this actor access this entity row? */
  verifyAccess: (ctx: ActorContext, entityId: string) => Promise<EntityAccessResult>;
  /** Human/LLM-readable summary of the row. */
  readSummary: (ctx: ActorContext, entityId: string) => Promise<unknown>;
}

const registry = new Map<string, EntityKind>();

export function registerEntityKind(kind: EntityKind): void {
  if (registry.has(kind.kind)) {
    console.warn(`[ConversationBindings] Duplicate entity kind: ${kind.kind}`);
    return;
  }
  registry.set(kind.kind, kind);
}

export function getEntityKind(kind: string): EntityKind | undefined {
  return registry.get(kind);
}

export function getAllEntityKinds(): EntityKind[] {
  return Array.from(registry.values());
}

// Domains register here as they migrate (Phase 4+): publication, author,
// venue, project, institution. None registered yet.

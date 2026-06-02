/* ── IngestionWorkflow ─────────────────────────────────────────
 * Orchestrates the per-DOI write path (DGA_DESIGN §35). A Workflow is the
 * ONLY role allowed to call Governors directly. Here it drives the single
 * publication write: PublicationGovernor.upsert (paper row + all entity edges,
 * which internally resolves authors/venues/institutions + venue flags).
 *
 * The four-source fetch + normalize stays in store.js (a Dispatcher concern —
 * outbound HTTP); this workflow takes the already-normalized record and owns
 * the governed write + the `ingestion.completed` event. store.js /
 * store-openalex.js become thin callers: fetch/normalize → run(ctx, input).
 *
 * Actor: ingestion is largely a system/job act (no logged-in editor on the
 * refetch/batch paths), so callers pass `systemActor(tenantId)` unless a real
 * actor is on hand. withTenant arrives in the RLS phase.
 * ──────────────────────────────────────────────────────────── */

import type { ActorContext } from "../../substrate/actor";
import { eventBus } from "../EventBus";
import { publicationGovernor } from "../catalog/PublicationGovernor";
import type { UpsertPublicationInput } from "../catalog/PublicationGovernor";

class IngestionWorkflow {
  /** Store one normalized DOI: upsert the paper + its edges via
   *  PublicationGovernor, then emit `ingestion.completed`. Returns the
   *  publications.id. */
  async run(ctx: ActorContext, input: UpsertPublicationInput): Promise<number> {
    const publicationId = await publicationGovernor.upsert(ctx, input);
    eventBus.emit("ingestion.completed", {
      tenantId: ctx.tenantId, publicationId, doi: input.record.doi,
      actorUserId: ctx.userId, actorKind: ctx.actorKind,
    });
    return publicationId;
  }
}

export const ingestionWorkflow = new IngestionWorkflow();

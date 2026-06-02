/* ── VenueGovernor ─────────────────────────────────────────────
 * Sole writer for venue-level state that isn't a per-paper edge. Today one
 * action: `setIndexation` — rebuild the in_wos/in_scopus/in_doaj/in_scielo
 * flags for a tenant's venues from the `indexed_journals` registry
 * (DGA_DESIGN §Venue). Wraps `rebuildVenueFlags` unchanged; emits
 * `venue.indexationUpdated` AFTER the write.
 *
 * Per-paper venue rows + published_in edges are written by PublicationGovernor
 * (they belong to the publication aggregate's edge sync). `upsert`/`merge`
 * (ISSN-dedup) land here later. withTenant arrives in the RLS phase.
 * ──────────────────────────────────────────────────────────── */

import { BaseGovernor } from "../BaseGovernor";
import type { ActorContext } from "../../substrate/actor";
const { rebuildVenueFlags } = require("../../lib/venue-flags-rebuild");
const { upsertVenues, applyRecordVenueFlags } = require("../../lib/db-venues-sync");

class VenueGovernor extends BaseGovernor {
  /** Sole writer of the `venues` table on ingest: upsert every venue tag for a
   *  record (idempotent by name_key). Called by IngestionWorkflow before edges.
   *  Quiet by design (see PLAN-ingest-sole-writer-split). */
  async upsertFromTags(ctx: ActorContext, tags: Array<Record<string, unknown>>): Promise<void> {
    await upsertVenues(ctx.tenantId, tags);
  }

  /** Sole writer of the venues.in_* flags on ingest: OR this record's
   *  indexation sources onto the venues it published in (never clears). Runs
   *  after published_in edges exist. */
  async applyRecordFlags(ctx: ActorContext, recordId: number, sources: string[]): Promise<void> {
    await applyRecordVenueFlags(recordId, ctx.tenantId, sources);
  }

  /** Rebuild this tenant's venue indexation flags from the indexed_journals
   *  registry (sibling-aware: matches by issn_l + name-key). Idempotent —
   *  resets all four flags then sets from the registry. Returns rows updated. */
  async setIndexation(ctx: ActorContext): Promise<number> {
    const updated = await rebuildVenueFlags(ctx.tenantId);
    this.emitEvent("venue.indexationUpdated", {
      tenantId: ctx.tenantId, updated, actorUserId: ctx.userId, actorKind: ctx.actorKind,
    });
    await this.logToLedger(ctx.tenantId, `venue:tenant:${ctx.tenantId}`, "venue.indexationUpdated", ctx.userId);
    return updated;
  }
}

export const venueGovernor = new VenueGovernor();

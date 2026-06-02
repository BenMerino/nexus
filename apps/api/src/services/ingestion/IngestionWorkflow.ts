/* ── IngestionWorkflow ─────────────────────────────────────────
 * Orchestrates the per-DOI write path (DGA_DESIGN §35). A Workflow is the ONLY
 * role allowed to call Governors directly. It resolves each entity through its
 * OWN governor (the sole writer of that table), then links the publication's
 * edges — the doctrine-pure shape that makes Author/Venue/Institution genuine
 * sole-writers instead of having PublicationGovernor write their tables.
 *
 * Order (must match the legacy syncRecordEntities result — proven by
 * scripts/verify-governor-wrap.js): paper row → entity upserts (author, venue,
 * institution) → publication edges → venue indexation flags (depend on the
 * published_in edges) → emit `ingestion.completed`.
 *
 * The 4-source fetch + normalize stays in store.js (Dispatcher concern); this
 * workflow takes the normalized record + derives the canonical tag-shaped array.
 * ──────────────────────────────────────────────────────────── */

import type { ActorContext } from "../../substrate/actor";
import { eventBus } from "../EventBus";
import { canonTags } from "../catalog/PublicationLogic";
import { publicationGovernor, type UpsertPublicationInput } from "../catalog/PublicationGovernor";
import { authorGovernor } from "../catalog/AuthorGovernor";
import { venueGovernor } from "../catalog/VenueGovernor";
import { institutionGovernor } from "../catalog/InstitutionGovernor";
const { indexationForIssn } = require("../../lib/indexed-journals");

class IngestionWorkflow {
  /** Store one normalized DOI through the per-table governors, then emit
   *  `ingestion.completed`. Returns the publications.id. */
  async run(ctx: ActorContext, input: UpsertPublicationInput): Promise<number> {
    const { record } = input;
    const tags = canonTags(record);

    // 1. Paper row (need its id + the stored tenant for the entity writes).
    const { id, tenantId } = await publicationGovernor.upsertRow(ctx, input);
    const tctx: ActorContext = { ...ctx, tenantId };

    // 2. Entity tables — each governor is the sole writer of its own.
    await authorGovernor.upsertFromTags(tctx, tags);
    await venueGovernor.upsertFromTags(tctx, tags);
    await institutionGovernor.upsertFromTags(tctx, tags, record);

    // 3. Publication edges (link the entities just upserted), emits publication.upserted.
    await publicationGovernor.linkEdges(tctx, id, tenantId, record, tags);

    // 4. Venue indexation flags — OR onto the venues this paper published in
    //    (depends on the published_in edges from step 3).
    const sources = await indexationForIssn(record.issnL);
    await venueGovernor.applyRecordFlags(tctx, id, sources);

    eventBus.emit("ingestion.completed", {
      tenantId, publicationId: id, doi: record.doi,
      actorUserId: ctx.userId, actorKind: ctx.actorKind,
    });
    return id;
  }
}

export const ingestionWorkflow = new IngestionWorkflow();

/* ── AuthorGovernor ────────────────────────────────────────────
 * Sole writer for the author aggregate (authors keyed by ORCID + the
 * authorship edges that bind a researcher to publications). First action
 * migrated: `claim` — a logged-in researcher asserting they authored a
 * publication, which creates the authorship EDGE (the entity form of the
 * legacy author-tag claim in handlers/claim-paper). Without this, a claimed
 * paper would not appear under the user's entity-backed personal scope.
 *
 * Pattern mirrors ProjectGovernor: validate → repo write (legacy `sql` pool;
 * withTenant arrives in the RLS phase) → emit `author.claimed` AFTER the
 * write → audit-log. `merge`/`upsert` (DGA_DESIGN §Author) land later.
 * ──────────────────────────────────────────────────────────── */

import { BaseGovernor } from "../BaseGovernor";
import type { ActorContext } from "../../substrate/actor";
import { claimAuthorship } from "../../lib/db-entities";

export interface ClaimInput {
  publicationId: number;
  /** Display name to seed a new author row (existing names are not clobbered). */
  name?: string;
}

class AuthorGovernor extends BaseGovernor {
  /** Bind the acting researcher (ctx.orcid) to a publication as an authorship
   *  edge. Idempotent: re-claiming is a no-op. Returns whether the edge was new. */
  async claim(ctx: ActorContext, input: ClaimInput): Promise<{ created: boolean }> {
    if (!ctx.orcid) throw new Error("claim requires an ORCID on the actor");
    if (!input.publicationId) throw new Error("publicationId required");
    const res = await claimAuthorship(input.publicationId, ctx.tenantId, ctx.orcid, input.name);
    if (res.created) {
      this.emitEvent("author.claimed", {
        tenantId: ctx.tenantId, orcid: ctx.orcid, publicationId: input.publicationId,
        actorUserId: ctx.userId, actorKind: ctx.actorKind,
      });
      await this.logToLedger(ctx.tenantId, `author:${ctx.orcid}`, "author.claimed", ctx.userId,
        { publicationId: input.publicationId });
    }
    return res;
  }
}

export const authorGovernor = new AuthorGovernor();

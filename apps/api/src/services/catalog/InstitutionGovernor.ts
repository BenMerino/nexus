/* ── InstitutionGovernor ───────────────────────────────────────
 * Sole writer for institution entity-resolution — folding duplicate
 * institution identities into one canonical row (DGA_DESIGN §Institution).
 * The entity-model replacement for the read-time tag_synonyms fold.
 *
 * Wraps the existing repos unchanged: `mergeInstitution` (by id pair) and
 * `mergeInstitutionSynonym` (variant name → canonical ROR). Emits
 * `institution.merged` AFTER the write. Per-paper pub↔institution edges are
 * written by PublicationGovernor; this governor owns only the merge.
 * withTenant arrives in the RLS phase.
 * ──────────────────────────────────────────────────────────── */

import { BaseGovernor } from "../BaseGovernor";
import type { ActorContext } from "../../substrate/actor";
const { mergeInstitution, mergeInstitutionSynonym } = require("../../lib/db-institution-merge");
const { upsertInstitutions } = require("../../lib/db-entities");

class InstitutionGovernor extends BaseGovernor {
  /** Sole writer of the `institutions` table on ingest: upsert institutions from
   *  this record's institution tags AND author-mediated affiliations (idempotent
   *  by ror). Called by IngestionWorkflow before edges. Quiet by design. */
  async upsertFromTags(ctx: ActorContext, tags: Array<Record<string, unknown>>, record: unknown): Promise<void> {
    await upsertInstitutions(ctx.tenantId, tags, record);
  }

  /** Fold institution `fromId` into `intoId` (re-point edges, delete variant).
   *  Idempotent. */
  async merge(ctx: ActorContext, fromId: number, intoId: number): Promise<void> {
    if (fromId === intoId) return;
    await mergeInstitution(fromId, intoId);
    this.emitEvent("institution.merged", {
      tenantId: ctx.tenantId, intoId, variantsMerged: 1,
      actorUserId: ctx.userId, actorKind: ctx.actorKind,
    });
    await this.logToLedger(ctx.tenantId, `institution:${intoId}`, "institution.merged", ctx.userId,
      { fromId });
  }

  /** Apply one synonym (variant name → canonical ROR) as an entity merge:
   *  fold every variant institution sharing the name into the canonical row.
   *  Idempotent. Returns the number of variants merged. */
  async mergeSynonym(ctx: ActorContext, variant: string, rorId: string): Promise<number> {
    const merged = await mergeInstitutionSynonym(ctx.tenantId, variant, rorId);
    if (merged > 0) {
      this.emitEvent("institution.merged", {
        tenantId: ctx.tenantId, variantsMerged: merged,
        actorUserId: ctx.userId, actorKind: ctx.actorKind,
      });
      await this.logToLedger(ctx.tenantId, `institution:ror:${rorId}`, "institution.merged", ctx.userId,
        { variant, variantsMerged: merged });
    }
    return merged;
  }
}

export const institutionGovernor = new InstitutionGovernor();

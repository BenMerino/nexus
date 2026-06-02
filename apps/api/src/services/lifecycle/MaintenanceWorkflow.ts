/* ── MaintenanceWorkflow ───────────────────────────────────────
 * Keep-clean: surface duplicate-entity candidates and execute CONFIRMED merges.
 * A Workflow — it calls InstitutionGovernor.merge (the sole writer).
 *
 * Honest scope (verified): institutions all carry a ROR, so there is no auto-safe
 * "fold the ROR-less variant" case — every duplicate is same-name/different-ROR,
 * a real data conflict that must NOT be auto-merged (mergeInstitution deletes a
 * row; two RORs can be a university AND its hospital). So `survey` returns the
 * candidates for human review, and `mergeConfirmed` executes a SPECIFIC merge an
 * admin approved (by id pair). The nightly lifecycle run only surveys; it never
 * auto-merges institutions.
 * ──────────────────────────────────────────────────────────── */

import type { ActorContext } from "../../substrate/actor";
import { maintenanceResolver, type DuplicateInstitution } from "./MaintenanceResolver";
import { institutionGovernor } from "../catalog/InstitutionGovernor";

export interface MaintenanceSurvey {
  tenantId: number;
  duplicateInstitutions: DuplicateInstitution[];
  autoMerged: number; // always 0 today — institution dupes are suggest-only
}

class MaintenanceWorkflow {
  /** Read-only survey of cleanliness candidates (what the nightly run reports). */
  async survey(ctx: ActorContext): Promise<MaintenanceSurvey> {
    const dups = await maintenanceResolver.findDuplicateInstitutions(ctx);
    return { tenantId: ctx.tenantId, duplicateInstitutions: dups, autoMerged: 0 };
  }

  /** Execute an admin-confirmed institution merge (fold fromId into intoId).
   *  The one place the lifecycle writes entity identity — gated on explicit
   *  human approval, never automatic. */
  async mergeConfirmed(ctx: ActorContext, fromId: number, intoId: number): Promise<void> {
    if (!fromId || !intoId) throw new Error("fromId and intoId required");
    await institutionGovernor.merge(ctx, fromId, intoId);
  }
}

export const maintenanceWorkflow = new MaintenanceWorkflow();

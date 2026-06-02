/* ── Assessor (Resolver) ───────────────────────────────────────
 * The lifecycle PLANNER: reads a tenant's data state and returns a previewable
 * AssessmentPlan — a list of recommended actions, each with a reason and a
 * priority. Pure read: no writes, no events, calls no governor (Resolver
 * contract). "Deciding" lives here; "doing" is the LifecycleWorkflow. The plan
 * is the supervision surface — an admin (or the scheduler) can see WHAT would
 * happen and WHY before anything runs.
 * ──────────────────────────────────────────────────────────── */

import type { ActorContext } from "../../substrate/actor";
import { maintenanceResolver } from "./MaintenanceResolver";
const lifecycle = require("../../lib/db-lifecycle");

export type LifecycleAction =
  | "suggest-ror" | "resolve-orcid" | "ingest-new" | "refresh-stale" | "merge-institutions";

export interface PlannedAction {
  action: LifecycleAction;
  target: string;   // "tenant:7" | "institution:12~34"
  reason: string;   // human-readable WHY
  priority: number; // 1 (highest) .. 5; scheduler dispatches ascending
  count?: number;
}

export interface AssessmentPlan {
  tenantId: number;
  actions: PlannedAction[];
  summary: {
    orcidUsers: number; orcidlessUsers: number;
    publications: number; authors: number; institutions: number;
    stale: number; dupes: number;
  };
}

class Assessor {
  async assess(ctx: ActorContext): Promise<AssessmentPlan> {
    const tenantId = ctx.tenantId;
    const [counts, stale, dupes] = await Promise.all([
      lifecycle.tenantCounts(tenantId),
      lifecycle.staleCount(tenantId),
      maintenanceResolver.findDuplicateInstitutions(ctx),
    ]);

    const actions: PlannedAction[] = [];

    if (counts.orcidlessUsers > 0) {
      actions.push({ action: "resolve-orcid", target: `tenant:${tenantId}`, priority: 2,
        count: counts.orcidlessUsers,
        reason: `${counts.orcidlessUsers} academic(s) have no ORCID — their publications can't be pulled until resolved.` });
    }
    if (counts.orcidUsers > 0 && counts.publications === 0) {
      actions.push({ action: "ingest-new", target: `tenant:${tenantId}`, priority: 1,
        count: counts.orcidUsers,
        reason: `Tenant has ${counts.orcidUsers} ORCID-linked academic(s) but 0 publications — initial load needed.` });
    }
    if (stale > 0) {
      actions.push({ action: "refresh-stale", target: `tenant:${tenantId}`, priority: 3, count: stale,
        reason: `${stale} researcher(s) never synced or stale (>${lifecycle.STALE_DAYS}d) — pull new OpenAlex works.` });
    }
    if (dupes.length > 0) {
      actions.push({ action: "merge-institutions", target: `tenant:${tenantId}`, priority: 4, count: dupes.length,
        reason: `${dupes.length} same-name/different-ROR institution pair(s) — review for merge (not auto-merged).` });
    }

    actions.sort((a, b) => a.priority - b.priority);
    return {
      tenantId, actions,
      summary: {
        orcidUsers: counts.orcidUsers, orcidlessUsers: counts.orcidlessUsers,
        publications: counts.publications, authors: counts.authors, institutions: counts.institutions,
        stale, dupes: dupes.length,
      },
    };
  }
}

export const assessor = new Assessor();

/* ── Claustro (Resolver) ───────────────────────────────────────
 * Pure, scope-narrowed READS for the CNA faculty-classification surface
 * (DGA_DESIGN §Claustro resolver). Computes each tenant's claustro (which
 * academics qualify for which graduate program) and validates programs against
 * the accreditation thresholds. NO writes, NO events (Resolver contract).
 *
 * Wraps the existing `lib/claustro.js` read functions behind one typed surface;
 * handlers delegate here instead of importing the lib directly (the lib stays
 * the data layer, N4). The accepted-indices WRITE (setAcceptedIndices) is NOT
 * here — a Resolver is read-only; that config write keeps its current path
 * until a tenant-config governor lands.
 *
 * `ActorContext.tenantId` is the only scope these reads need.
 * ──────────────────────────────────────────────────────────── */

import type { ActorContext } from "../../substrate/actor";
const claustro = require("../../lib/claustro");

/** The three CNA graduate-program types validated against the claustro. */
export const PROGRAMS = ["doctorado", "magister_academico", "magister_profesional"] as const;
export type Program = (typeof PROGRAMS)[number];

class Claustro {
  /** The tenant's full faculty classification (every active academic/director
   *  scored against the program criteria). */
  list(ctx: ActorContext) {
    return claustro.getClaustroForTenant(ctx.tenantId);
  }

  /** Validate ONE program's enrollment against the accreditation thresholds. */
  async validate(ctx: ActorContext, program: Program) {
    const c = await claustro.getClaustroForTenant(ctx.tenantId);
    return claustro.validateProgram(c, program);
  }

  /** Validate all three programs in one pass (shares one claustro fetch). */
  async validateAll(ctx: ActorContext) {
    const c = await claustro.getClaustroForTenant(ctx.tenantId);
    const programs: Record<string, unknown> = {};
    for (const p of PROGRAMS) programs[p] = claustro.validateProgram(c, p);
    return { claustro: c, programs };
  }

  /** The tenant's accepted citation indices (drives the classification). */
  acceptedIndices(ctx: ActorContext) {
    return claustro.getAcceptedIndices(ctx.tenantId);
  }
}

export const claustroResolver = new Claustro();

/* ── MaintenanceResolver (Resolver) ────────────────────────────
 * Pure reads that FIND data-cleanliness candidates for a tenant — duplicate
 * entities the entity model accreted from upstream variance (e.g. OpenAlex
 * returning two RORs for one organization). No writes, no events (Resolver
 * contract). The Assessor reads these for its plan; MaintenanceWorkflow executes
 * the auto-safe subset.
 *
 * Reality check (verified against the schema): `institutions.ror` is NOT NULL and
 * every row is upserted WITH a ROR, so there are no "ROR-less variant" rows to
 * auto-fold. The real duplicate is same-name / different-ROR — a genuine data
 * conflict (a university and its hospital can share a name), so it is SUGGEST-
 * ONLY, never auto-merged (mergeInstitution deletes a row). Venue/author finders
 * are stubbed: venues are name_key-unique and authors are orcid-unique, so true
 * dupes are rare — shaped for later, returning [] today.
 * ──────────────────────────────────────────────────────────── */

import type { ActorContext } from "../../substrate/actor";
const { sql } = require("../../lib/sql");

export interface DuplicateInstitution {
  name: string;
  rorA: string; idA: number;
  rorB: string; idB: number;
  /** suggest = needs human confirm (two real RORs); never auto-merged. */
  kind: "suggest";
}

class MaintenanceResolver {
  /** Same normalized name, different ROR, within a tenant. Suggest-only. */
  async findDuplicateInstitutions(ctx: ActorContext): Promise<DuplicateInstitution[]> {
    const r = await sql`
      SELECT a.id AS id_a, a.ror AS ror_a, b.id AS id_b, b.ror AS ror_b, a.name
      FROM institutions a
      JOIN institutions b
        ON b.tenant_id = a.tenant_id
       AND lower(b.name) = lower(a.name)
       AND a.ror <> b.ror
       AND a.id < b.id
      WHERE a.tenant_id = ${ctx.tenantId}
      ORDER BY a.name`;
    return r.rows.map((x: any) => ({
      name: x.name, rorA: x.ror_a, idA: x.id_a, rorB: x.ror_b, idB: x.id_b, kind: "suggest" as const,
    }));
  }

  /** Stubs — venues are name_key-unique, authors orcid-unique; dupes rare.
   *  Shaped so MaintenanceWorkflow's surface is stable when these grow. */
  async findDuplicateVenues(_ctx: ActorContext): Promise<unknown[]> { return []; }
  async findDuplicateAuthors(_ctx: ActorContext): Promise<unknown[]> { return []; }
}

export const maintenanceResolver = new MaintenanceResolver();

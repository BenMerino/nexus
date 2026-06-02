// Institution entity-resolution: merging duplicate institution rows (the
// entity-model replacement for the read-time tag_synonyms fold). Split from
// db-entities.js (per-record sync) — this is its own concern: collapsing two
// institution identities into one. The future InstitutionGovernor.merge wraps
// these; today they're called by synonym-confirm (write-time) + the backfill.

const { sql } = require("./sql");
const { normRor } = require("./entity-normalize");

// Merge institution `fromId` INTO `intoId`. Re-points the variant's affiliation
// + affiliated_with edges to the canonical (dedupe via NOT EXISTS) and deletes
// the variant row. Idempotent (a second call no-ops once fromId is gone).
async function mergeInstitution(fromId, intoId) {
  if (fromId === intoId) return;
  await sql`UPDATE affiliation SET institution_id = ${intoId}
    WHERE institution_id = ${fromId}
      AND NOT EXISTS (
        SELECT 1 FROM affiliation b WHERE b.institution_id = ${intoId}
          AND b.publication_id = affiliation.publication_id
          AND b.author_id = affiliation.author_id)`;
  await sql`DELETE FROM affiliation WHERE institution_id = ${fromId}`;
  await sql`UPDATE affiliated_with SET institution_id = ${intoId}
    WHERE institution_id = ${fromId}
      AND NOT EXISTS (
        SELECT 1 FROM affiliated_with b WHERE b.institution_id = ${intoId}
          AND b.publication_id = affiliated_with.publication_id)`;
  await sql`DELETE FROM affiliated_with WHERE institution_id = ${fromId}`;
  await sql`DELETE FROM institutions WHERE id = ${fromId}`;
}

// Apply ONE institution synonym (variant name → canonical ROR) as an entity
// merge, at write time: find the variant institution(s) (same name, different
// ROR) and fold each into the canonical (by ROR). Idempotent. The single shared
// merge core used by both synonym-confirm and the backfill's applyInstitutionMerges.
async function mergeInstitutionSynonym(tenantId, variant, rorId) {
  if (!rorId || !variant) return 0;
  const canon = (await sql`SELECT id FROM institutions WHERE tenant_id = ${tenantId} AND ror = ${normRor(rorId)}`).rows[0];
  if (!canon) return 0;
  const variants = (await sql`SELECT id FROM institutions
    WHERE tenant_id = ${tenantId} AND name = ${variant} AND ror <> ${normRor(rorId)}`).rows;
  for (const v of variants) await mergeInstitution(v.id, canon.id);
  return variants.length;
}

module.exports = { mergeInstitution, mergeInstitutionSynonym };

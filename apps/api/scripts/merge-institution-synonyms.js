// One-time: apply institution tag_synonyms as entity merges (Step 4 prep).
//
// 25/28 institution synonyms are already consistent in the ROR-keyed entity
// model; ~3 are genuine cross-ROR merges (e.g. "Brain (Germany)" → "Life &
// Brain (Germany)") — human entity-resolution judgments the old read-time
// synonym fold applied. This folds them into the entity tables via
// mergeInstitution so institution-dependent readers (graph-builder) don't
// regress de-duplication. Idempotent.
//
//   railway ssh --service Nexus "cd /app/apps/api && node scripts/merge-institution-synonyms.js"

const { sql } = require("../src/lib/sql");
const { mergeInstitutionSynonym } = require("../src/lib/db-entities");

// Reusable: apply all institution synonym merges for a tenant. Called by the
// standalone script AND at the end of the backfill (so a backfill re-run, which
// recreates variant institutions from tags, always re-folds them). Idempotent.
// Delegates each synonym to the shared mergeInstitutionSynonym core (also called
// at synonym-confirm time, so confirm + backfill produce the same result).
async function applyInstitutionMerges(tenantId) {
  let merged = 0;
  const syns = (await sql`
    SELECT variant, ror_id FROM tag_synonyms
    WHERE tenant_id = ${tenantId} AND category = 'institution' AND ror_id IS NOT NULL`).rows;
  for (const s of syns) merged += await mergeInstitutionSynonym(tenantId, s.variant, s.ror_id);
  return merged;
}

async function main() {
  const tenants = (await sql`SELECT DISTINCT tenant_id FROM institutions`).rows.map((r) => r.tenant_id);
  let total = 0;
  for (const t of tenants) total += await applyInstitutionMerges(t);
  console.log(`Done. ${total} institution(s) merged.`);
  process.exit(0);
}

module.exports = { applyInstitutionMerges };

// Run as a standalone script only when invoked directly (not when imported).
if (require.main === module) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}

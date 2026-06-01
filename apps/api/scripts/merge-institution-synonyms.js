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
const { mergeInstitution } = require("../src/lib/db-entities");

async function main() {
  const tenants = (await sql`SELECT DISTINCT tenant_id FROM institutions`).rows.map((r) => r.tenant_id);
  let merged = 0;
  for (const t of tenants) {
    const syns = (await sql`
      SELECT variant, ror_id FROM tag_synonyms
      WHERE tenant_id = ${t} AND category = 'institution' AND ror_id IS NOT NULL`).rows;
    for (const s of syns) {
      // canonical institution = the one with the synonym's ror_id
      const canon = (await sql`SELECT id FROM institutions WHERE tenant_id = ${t} AND ror = ${s.ror_id}`).rows[0];
      if (!canon) continue;
      // variant institution(s) = rows whose NAME matches the variant but ROR differs
      const variants = (await sql`
        SELECT id FROM institutions WHERE tenant_id = ${t} AND name = ${s.variant} AND ror <> ${s.ror_id}`).rows;
      for (const v of variants) {
        await mergeInstitution(v.id, canon.id);
        merged++;
        console.log(`  merged inst ${v.id} → ${canon.id} (${s.variant} → ror ${s.ror_id})`);
      }
    }
  }
  console.log(`Done. ${merged} institution(s) merged.`);
  process.exit(0);
}

main().catch((e) => { console.error(e.message); process.exit(1); });

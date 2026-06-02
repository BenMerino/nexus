const { getSource } = require("./indexation-sources");
const { sql } = require("./sql");
const { rebuildVenueFlags } = require("./venue-flags-rebuild");
const openalexFlags = require("./seeders/openalex-flags");

// After a seed updates the indexed_journals registry, re-derive venue in_* flags
// (entity model) across all tenants — replacing the old indexed_in tag rebuild.
async function rebuildAllVenueFlags() {
  const tenants = (await sql`SELECT DISTINCT tenant_id FROM venues`).rows.map((r) => r.tenant_id);
  let venuesFlagged = 0;
  for (const t of tenants) venuesFlagged += await rebuildVenueFlags(t);
  return { venuesFlagged };
}

async function runSeed(sourceId, opts = {}) {
  const source = getSource(sourceId);
  if (!source) throw new Error(`Unknown source: ${sourceId}`);
  if (!source.seedFn) throw new Error(`No seeder configured for ${source.id}`);
  const imported = await source.seedFn(opts);
  const backfill = await rebuildAllVenueFlags();
  return { imported: { source: source.id, ...imported }, backfill };
}

async function runOpenAlexSeed() {
  const imported = await openalexFlags.seed();
  const backfill = await rebuildAllVenueFlags();
  return { imported, backfill };
}

module.exports = { runSeed, runOpenAlexSeed };

const { getSource } = require("./indexation-sources");
const { backfillIndexationTags, clearIndexationTagsForSource } = require("./indexed-backfill");
const openalexFlags = require("./seeders/openalex-flags");

async function runSeed(sourceId, opts = {}) {
  const source = getSource(sourceId);
  if (!source) throw new Error(`Unknown source: ${sourceId}`);
  if (!source.seedFn) throw new Error(`No seeder configured for ${source.id}`);
  const imported = await source.seedFn(opts);
  await clearIndexationTagsForSource(source.id);
  const backfill = await backfillIndexationTags();
  return { imported: { source: source.id, ...imported }, backfill };
}

async function runOpenAlexSeed() {
  const imported = await openalexFlags.seed();
  for (const s of ["WoS", "DOAJ", "SciELO"]) await clearIndexationTagsForSource(s);
  const backfill = await backfillIndexationTags();
  return { imported, backfill };
}

module.exports = { runSeed, runOpenAlexSeed };

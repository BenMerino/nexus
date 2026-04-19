const { getSource } = require("./indexation-sources");
const { backfillIndexationTags, clearIndexationTagsForSource } = require("./indexed-backfill");

async function runSeed(sourceId, opts = {}) {
  const source = getSource(sourceId);
  if (!source) throw new Error(`Unknown source: ${sourceId}`);
  if (!source.seedFn) throw new Error(`No seeder configured for ${source.id}`);
  const imported = await source.seedFn(opts);
  await clearIndexationTagsForSource(source.id);
  const backfill = await backfillIndexationTags();
  return { imported: { source: source.id, ...imported }, backfill };
}

module.exports = { runSeed };

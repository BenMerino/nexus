const { ensureSchema } = require("../src/lib/db");
const { getTagStats } = require("../src/lib/tag-stats-entities");
const { requireScope } = require("../src/lib/scope");

// GET /api/tag-stats — entity-backed grouped node stats {category, value, count}
// for the explore tag-cloud + author-import suggestions. Reads the entity graph
// (not tags). The former synonym-curation actions (candidates/confirm/dismiss/
// synonyms/delete-synonym/ror-lookup/ror-resolve) and the dead h-index/paginated
// branches were RETIRED with the tag-manager admin page (synonym merges now apply
// at write time via the entity model; see db-institution-merge.js).
module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  await ensureSchema();
  const scope = await requireScope(req, res);
  if (!scope) return;
  try {
    res.json(await getTagStats(scope));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

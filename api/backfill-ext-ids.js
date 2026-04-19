const { ensureSchema, getAllRecords, deleteTagsForRecord, insertTag } = require("../lib/db");
const { normalize, extractTags, canonicalize } = require("../lib/normalize");
const { requireScope } = require("../lib/scope");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const scope = await requireScope(req, res);
  if (!scope) return;
  if (scope.role !== "admin" && scope.role !== "superadmin") return res.status(403).json({ error: "Admin required" });
  await ensureSchema();

  try {
    const records = await getAllRecords(scope);
    let updated = 0;
    let skipped = 0;
    for (const r of records) {
      try {
        const sources = JSON.parse(r.raw_responses || "{}");
        const norm = normalize(r.doi, sources);
        const tags = extractTags(norm);
        await deleteTagsForRecord(r.id);
        for (const tag of tags) {
          await insertTag(r.id, tag.category, canonicalize(tag.category, tag.value), tag.ext_id);
        }
        updated++;
      } catch (e) {
        skipped++;
      }
    }
    res.json({ backfilled: updated, skipped, total: records.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

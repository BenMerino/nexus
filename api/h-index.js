const { ensureSchema, getAllRecords } = require("../lib/db");
const { calculateHIndex, getAuthorHIndexes } = require("../lib/h-index");

module.exports = async function handler(req, res) {
  if (req.method !== "GET")
    return res.status(405).json({ error: "Method not allowed" });

  await ensureSchema();
  try {
    const records = await getAllRecords();
    const authors = getAuthorHIndexes(records);
    const allCitations = records.map((r) => r.citation_count || 0);
    const collectionHIndex = calculateHIndex(allCitations);
    res.json({ collectionHIndex, authors });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

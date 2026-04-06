const { ensureSchema, getAllRecords } = require("../lib/db");
const { fetchAndStore } = require("../lib/store");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  await ensureSchema();
  try {
    const records = await getAllRecords();
    const results = [];
    for (const r of records) {
      try {
        const { record } = await fetchAndStore(r.doi, r.submission_id);
        results.push({ doi: r.doi, status: "ok", authorCount: record.authors?.length || 0 });
      } catch (err) {
        results.push({ doi: r.doi, status: "error", error: err.message });
      }
    }
    res.json({ refetched: results.length, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

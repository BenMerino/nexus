const { ensureSchema, getAllRecords } = require("../src/lib/db");
const { fetchAndStore } = require("../src/lib/store");
const { requireScope } = require("../src/lib/scope");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  await ensureSchema();
  const scope = await requireScope(req, res);
  if (!scope) return;
  if (scope.role !== "superadmin") return res.status(403).json({ error: "Superadmin required" });
  try {
    const records = await getAllRecords(scope);
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

const { ensureSchema, insertSubmission } = require("../src/lib/db");
const { fetchAndStore } = require("../src/lib/store");
const { requireRole } = require("../src/lib/auth");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const session = await requireRole(req, "superadmin");
  if (!session) return res.status(403).json({ error: "Superadmin required" });

  await ensureSchema();
  const { doi } = req.body;
  if (!doi) return res.status(400).json({ error: "doi is required" });

  try {
    const submissionId = await insertSubmission(doi, session.username);
    const result = await fetchAndStore(doi, submissionId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

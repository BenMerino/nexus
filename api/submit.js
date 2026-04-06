const { ensureSchema, insertSubmission } = require("../lib/db");
const { fetchAndStore } = require("../lib/store");
const { getUser } = require("../lib/auth");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const uploader = getUser(req);
  if (!uploader) return res.status(401).json({ error: "Not authenticated" });

  await ensureSchema();
  const { doi } = req.body;
  if (!doi) return res.status(400).json({ error: "doi is required" });

  try {
    const submissionId = await insertSubmission(doi, uploader);
    const result = await fetchAndStore(doi, submissionId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

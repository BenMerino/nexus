const { ensureSchema, insertSubmission } = require("../lib/db");
const { fetchAndStore } = require("../lib/store");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  await ensureSchema();
  const { doi, uploader } = req.body;
  if (!doi || !uploader) return res.status(400).json({ error: "doi and uploader are required" });

  try {
    const submissionId = await insertSubmission(doi, uploader);
    const result = await fetchAndStore(doi, submissionId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

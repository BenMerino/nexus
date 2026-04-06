const { ensureSchema, getSubmissions } = require("../lib/db");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  await ensureSchema();
  try {
    const submissions = await getSubmissions();
    res.json(submissions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

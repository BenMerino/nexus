const { ensureSchema } = require("../lib/db");
const { getGraphMetadata } = require("../lib/graph-meta");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  await ensureSchema();
  try {
    const data = await getGraphMetadata();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

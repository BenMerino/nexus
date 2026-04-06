const { sql } = require("@vercel/postgres");
const { ensureSchema } = require("../lib/db");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  await ensureSchema();
  try {
    const { rows } = await sql`
      SELECT category, value, COUNT(*) as count FROM tags
      GROUP BY category, value ORDER BY count DESC`;
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

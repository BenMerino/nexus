const { sql } = require("@vercel/postgres");
const { ensureSchema } = require("../lib/db");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  await ensureSchema();
  const q = req.query.q;
  if (!q || q.trim().length === 0) return res.json([]);

  const term = `%${q.trim()}%`;
  try {
    const { rows } = await sql`
      SELECT * FROM doi_records
      WHERE title ILIKE ${term} OR authors ILIKE ${term} OR journal ILIKE ${term}
        OR doi ILIKE ${term} OR publisher ILIKE ${term} OR venue ILIKE ${term}
      ORDER BY id DESC LIMIT 50`;

    const records = rows.map((r) => ({
      ...r,
      authors: r.authors ? JSON.parse(r.authors) : [],
    }));
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const { sql } = require("@vercel/postgres");
const { ensureSchema } = require("../lib/db");
const { requireScope, isPersonalScope } = require("../lib/scope");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  await ensureSchema();
  const scope = await requireScope(req, res);
  if (!scope) return;
  const q = req.query.q;
  if (!q || q.trim().length === 0) return res.json([]);

  const term = `%${q.trim()}%`;
  try {
    const { rows } = isPersonalScope(scope) ? await sql`
      SELECT * FROM doi_records
      WHERE (title ILIKE ${term} OR authors ILIKE ${term} OR journal ILIKE ${term}
        OR doi ILIKE ${term} OR publisher ILIKE ${term} OR venue ILIKE ${term})
        AND id IN (SELECT doi_record_id FROM tags WHERE category='author' AND ext_id=${scope.orcid})
      ORDER BY id DESC LIMIT 50`
    : await sql`
      SELECT * FROM doi_records
      WHERE (title ILIKE ${term} OR authors ILIKE ${term} OR journal ILIKE ${term}
        OR doi ILIKE ${term} OR publisher ILIKE ${term} OR venue ILIKE ${term})
        AND tenant_id = ${scope.tenantId}
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

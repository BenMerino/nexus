const { sql } = require("../src/lib/sql");
const { ensureSchema } = require("../src/lib/db");
const { searchRecordsPage } = require("../src/lib/db-list");
const { requireScope, isPersonalScope } = require("../src/lib/scope");
const { envelope } = require("../src/lib/pagination");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  await ensureSchema();
  const scope = await requireScope(req, res);
  if (!scope) return;
  const q = req.query.q;
  if (!q || q.trim().length === 0) {
    return req.query.paginated === "1"
      ? res.json(envelope({ data: [], total: 0, limit: 0, offset: 0 }))
      : res.json([]);
  }

  const term = q.trim();
  const parseRow = (r) => ({ ...r, authors: r.authors ? JSON.parse(r.authors) : [] });
  try {
    if (req.query.paginated === "1") {
      const page = await searchRecordsPage(scope, term, req.query);
      return res.json(envelope({ ...page, data: page.data.map(parseRow) }));
    }
    const like = `%${term}%`;
    const { rows } = isPersonalScope(scope) ? await sql`
      SELECT * FROM doi_records
      WHERE (title ILIKE ${like} OR authors ILIKE ${like} OR journal ILIKE ${like}
        OR doi ILIKE ${like} OR publisher ILIKE ${like} OR venue ILIKE ${like})
        AND id IN (SELECT doi_record_id FROM tags WHERE category='author' AND ext_id=${scope.orcid})
      ORDER BY id DESC LIMIT 50`
    : await sql`
      SELECT * FROM doi_records
      WHERE (title ILIKE ${like} OR authors ILIKE ${like} OR journal ILIKE ${like}
        OR doi ILIKE ${like} OR publisher ILIKE ${like} OR venue ILIKE ${like})
        AND tenant_id = ${scope.tenantId}
      ORDER BY id DESC LIMIT 50`;
    res.json(rows.map(parseRow));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

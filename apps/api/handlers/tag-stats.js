const { sql } = require("../src/lib/sql");
const { ensureSchema, getAllRecords } = require("../src/lib/db");
const { calculateHIndex, getAuthorHIndexes, hIndexByType } = require("../src/lib/h-index");
const { handleSynonymGet, handleSynonymPost, handleSynonymDelete } = require("../src/lib/synonym-handlers");
const { lookupInstitution } = require("../src/lib/openalex");
const { requireScope } = require("../src/lib/scope");

module.exports = async function handler(req, res) {
  await ensureSchema();
  const scope = await requireScope(req, res);
  if (!scope) return;
  const action = req.query.action || "tags";
  const tenantId = scope.tenantId;

  try {
    if (["synonyms", "candidates"].includes(action) && req.method === "GET") {
      return handleSynonymGet(action, req, res, tenantId);
    }
    if (["confirm", "dismiss"].includes(action) && req.method === "POST") {
      return handleSynonymPost(action, req, res, tenantId);
    }
    if (action === "delete-synonym" && req.method === "DELETE") {
      return handleSynonymDelete(req, res, tenantId);
    }
    if (action === "ror-lookup" && req.method === "GET") {
      const q = req.query.q;
      if (!q) return res.status(400).json({ error: "q required" });
      return res.json(await lookupInstitution(q));
    }
    if (action === "ror-resolve" && req.method === "POST") {
      return require("../src/lib/ror-resolve")(req, res, tenantId);
    }

    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

    if (action === "h-index") {
      const records = await getAllRecords(scope);
      const authors = getAuthorHIndexes(records);
      const allCitations = records.map((r) => r.citation_count || 0);
      return res.json({
        collectionHIndex: calculateHIndex(allCitations),
        collectionHIndexByType: hIndexByType(records),
        authors,
      });
    }

    if (req.query.paginated === "1") {
      const { paginatedQuery } = require("../src/db/list");
      const { envelope } = require("../src/lib/pagination");
      const page = await paginatedQuery({
        baseSql: `
          SELECT t.category,
            MAX(COALESCE(s.canonical, t.value)) AS value,
            COALESCE(t.ext_id, COALESCE(s.canonical, t.value)) AS group_key,
            MAX(t.ext_id) AS ext_id,
            COUNT(*) as count
          FROM tags t
          JOIN doi_records d ON d.id = t.doi_record_id
          LEFT JOIN tag_synonyms s ON s.category = t.category AND s.variant = t.value AND s.tenant_id = $1
          WHERE d.tenant_id = $1
          GROUP BY t.category, COALESCE(t.ext_id, COALESCE(s.canonical, t.value))
        `,
        baseParams: [tenantId],
        orderBy: "count DESC",
        query: req.query,
      });
      return res.json(envelope(page));
    }

    const { rows } = await sql`
      SELECT t.category,
        MAX(COALESCE(s.canonical, t.value)) AS value,
        COALESCE(t.ext_id, COALESCE(s.canonical, t.value)) AS group_key,
        MAX(t.ext_id) AS ext_id,
        COUNT(*) as count
      FROM tags t
      JOIN doi_records d ON d.id = t.doi_record_id
      LEFT JOIN tag_synonyms s ON s.category = t.category AND s.variant = t.value AND s.tenant_id = ${tenantId}
      WHERE d.tenant_id = ${tenantId}
      GROUP BY t.category, COALESCE(t.ext_id, COALESCE(s.canonical, t.value))
      ORDER BY count DESC`;
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

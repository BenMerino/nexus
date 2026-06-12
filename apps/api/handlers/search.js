const { sql } = require("../src/lib/sql");
const { ensureSchema } = require("../src/lib/db");
const { searchRecordsPage } = require("../src/lib/db-list");
const { requireScope, isPersonalScope } = require("../src/lib/scope");
const { normOrcid } = require("../src/lib/entity-normalize");
const { envelope } = require("../src/lib/pagination");
const { matchClause } = require("../src/lib/search-match");

// The text columns explore searches across — shared by both scope branches
// here and by searchRecordsPage (db-list) so paginated + non-paginated match
// identically.
const RECORD_COLS = ["title", "authors", "journal", "doi", "publisher", "venue"];

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
    // Shared engine: tokenized + accent-folded across the record text columns.
    // $1 = tenantId (personal also binds orcid at $2); tokens follow.
    const personal = isPersonalScope(scope);
    const m = matchClause(RECORD_COLS, term, personal ? 3 : 2);
    if (!m.sql) return res.json([]);
    const { rows } = personal ? await sql.query(
      `SELECT * FROM doi_records
       WHERE (${m.sql})
         AND id IN (SELECT s.publication_id FROM authorship s JOIN authors a ON a.id=s.author_id
           WHERE a.orcid=$2 AND a.tenant_id=$1)
       ORDER BY id DESC LIMIT 50`, [scope.tenantId, normOrcid(scope.orcid), ...m.params])
    : await sql.query(
      `SELECT * FROM doi_records
       WHERE (${m.sql}) AND tenant_id = $1
       ORDER BY id DESC LIMIT 50`, [scope.tenantId, ...m.params]);
    res.json(rows.map(parseRow));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

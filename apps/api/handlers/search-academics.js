const { sql } = require("../src/lib/sql");
const { ensureSchema } = require("../src/lib/db");
const { requireScope } = require("../src/lib/scope");
const { matchClause } = require("../src/lib/search-match");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  await ensureSchema();
  const scope = await requireScope(req, res);
  if (!scope) return;

  const q = (req.query.q || "").trim();
  if (q.length < 2) return res.json([]);

  // Shared search engine: tokenized + accent-folded across the academic's
  // identity/role columns. $1 = tenantId; tokens start at $2.
  const m = matchClause(
    ["full_name", "username", "email", "orcid", "position", "faculty", "grado_academico"], q, 2);
  if (!m.sql) return res.json([]);
  const { rows } = await sql.query(
    `SELECT id, full_name, orcid, position, faculty, grado_academico
     FROM users
     WHERE tenant_id = $1
       AND active = TRUE
       AND orcid IS NOT NULL
       AND (${m.sql})
     ORDER BY full_name
     LIMIT 12`, [scope.tenantId, ...m.params]);

  res.json(rows.map(r => ({
    name: r.full_name,
    orcid: r.orcid,
    position: r.position,
    faculty: r.faculty,
    grade: r.grado_academico,
  })));
};

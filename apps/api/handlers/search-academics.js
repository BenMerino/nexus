const { sql } = require("../src/lib/sql");
const { ensureSchema } = require("../src/lib/db");
const { requireScope } = require("../src/lib/scope");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  await ensureSchema();
  const scope = await requireScope(req, res);
  if (!scope) return;

  const q = (req.query.q || "").trim();
  if (q.length < 2) return res.json([]);

  const term = `%${q}%`;
  const { rows } = await sql`
    SELECT id, full_name, orcid, position, faculty, grado_academico
    FROM users
    WHERE tenant_id = ${scope.tenantId}
      AND active = TRUE
      AND orcid IS NOT NULL
      AND (
        full_name ILIKE ${term}
        OR username ILIKE ${term}
        OR email ILIKE ${term}
        OR orcid ILIKE ${term}
        OR position ILIKE ${term}
        OR faculty ILIKE ${term}
        OR grado_academico ILIKE ${term}
      )
    ORDER BY full_name
    LIMIT 12`;

  res.json(rows.map(r => ({
    name: r.full_name,
    orcid: r.orcid,
    position: r.position,
    faculty: r.faculty,
    grade: r.grado_academico,
  })));
};

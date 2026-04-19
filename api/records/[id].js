const { sql } = require("@vercel/postgres");
const { ensureSchema, deleteTagsForRecord, deleteRecord, deleteSubmissionsForDoi } = require("../../lib/db");
const { getScope } = require("../../lib/scope");

module.exports = async function handler(req, res) {
  if (req.method !== "DELETE") return res.status(405).json({ error: "Method not allowed" });

  await ensureSchema();
  const scope = await getScope(req);
  if (scope.role !== "superadmin") return res.status(403).json({ error: "Superadmin required" });
  const id = Number(req.query.id);

  try {
    const { rows } = await sql`SELECT doi FROM doi_records WHERE id = ${id} AND tenant_id = ${scope.tenantId}`;
    if (!rows[0]) return res.status(404).json({ error: "Record not found" });

    await deleteTagsForRecord(id);
    await deleteRecord(id);
    await deleteSubmissionsForDoi(rows[0].doi);
    res.json({ deleted: true, doi: rows[0].doi });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

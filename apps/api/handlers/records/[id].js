const { sql } = require("../../src/lib/sql");
const { ensureSchema, deleteTagsForRecord, deleteRecord, deleteSubmissionsForDoi } = require("../../src/lib/db");
const { getScope, requireScope, isPersonalScope } = require("../../src/lib/scope");
const { normOrcid } = require("../../src/lib/entity-normalize");

module.exports = async function handler(req, res) {
  await ensureSchema();

  if (req.method === "GET") {
    const scope = await requireScope(req, res);
    if (!scope) return;
    const doi = decodeURIComponent(req.query.id || "");
    if (!doi) return res.status(400).json({ error: "Missing DOI" });
    try {
      let rows;
      if (isPersonalScope(scope)) {
        ({ rows } = await sql`SELECT doi, title, authors, abstract, journal, published, citation_count, type, open_access_url
          FROM doi_records WHERE doi = ${doi}
          AND id IN (SELECT s.publication_id FROM authorship s JOIN authors a ON a.id=s.author_id
            WHERE a.orcid=${normOrcid(scope.orcid)} AND a.tenant_id=${scope.tenantId})`);
      } else {
        ({ rows } = await sql`SELECT doi, title, authors, abstract, journal, published, citation_count, type, open_access_url
          FROM doi_records WHERE doi = ${doi} AND tenant_id = ${scope.tenantId}`);
      }
      if (!rows[0]) return res.status(404).json({ error: "Not found" });
      const r = rows[0];
      res.json({ ...r, authors: r.authors ? JSON.parse(r.authors) : [] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
    return;
  }

  if (req.method !== "DELETE") return res.status(405).json({ error: "Method not allowed" });

  const scope = await getScope(req);
  if (scope?.role !== "superadmin") return res.status(403).json({ error: "Superadmin required" });
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

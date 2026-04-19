const { sql } = require("@vercel/postgres");
const { ensureSchema, insertTag } = require("../lib/db");
const { requireRole } = require("../lib/auth");
const { extractSourceIndices } = require("../lib/normalize-openalex");

async function fetchWork(doi) {
  const resp = await fetch(`https://api.openalex.org/works/doi:${encodeURIComponent(doi)}`);
  if (!resp.ok) return null;
  return await resp.json();
}

module.exports = async function handler(req, res) {
  await ensureSchema();
  const sa = await requireRole(req, "superadmin");
  if (!sa) return res.status(403).json({ error: "Superadmin required" });

  const limit = parseInt(req.query.limit) || 1000;
  const tenantId = req.query.tenantId ? parseInt(req.query.tenantId) : null;

  const records = tenantId
    ? await sql`SELECT id, doi FROM doi_records WHERE tenant_id = ${tenantId} ORDER BY id LIMIT ${limit}`
    : await sql`SELECT id, doi FROM doi_records ORDER BY id LIMIT ${limit}`;

  if (tenantId) {
    await sql`DELETE FROM tags WHERE category = 'source' AND doi_record_id IN (
      SELECT id FROM doi_records WHERE tenant_id = ${tenantId})`;
  } else {
    await sql`DELETE FROM tags WHERE category = 'source'`;
  }

  let tagged = 0, missed = 0, errored = 0;
  for (const r of records.rows) {
    try {
      const work = await fetchWork(r.doi);
      if (!work) { missed++; continue; }
      const indices = extractSourceIndices(work);
      for (const src of indices) {
        await insertTag(r.id, "source", src, null);
        tagged++;
      }
    } catch (err) {
      errored++;
    }
  }
  res.json({ scanned: records.rows.length, tagged, missed, errored });
};

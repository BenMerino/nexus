const { sql } = require("@vercel/postgres");
const { findCandidates } = require("./synonym-candidates");

async function handleSynonymGet(action, req, res, tenantId) {
  if (action === "synonyms") {
    const { rows } = await sql`
      SELECT * FROM tag_synonyms WHERE tenant_id = ${tenantId}
      ORDER BY category, canonical`;
    return res.json(rows);
  }
  if (action === "candidates") {
    const category = req.query.category || null;
    const threshold = parseFloat(req.query.threshold) || 0.7;
    return res.json(await findCandidates(category, threshold, tenantId));
  }
  return null;
}

async function handleSynonymPost(action, req, res, tenantId) {
  if (action === "confirm") {
    const { category, variant, canonical, source, ror_id } = req.body;
    if (!category || !variant || !canonical) return res.status(400).json({ error: "Missing fields" });
    await sql`
      INSERT INTO tag_synonyms (category, variant, canonical, source, tenant_id, ror_id)
      VALUES (${category}, ${variant}, ${canonical}, ${source || "manual"}, ${tenantId}, ${ror_id || null})
      ON CONFLICT(category, variant) DO UPDATE
      SET canonical = EXCLUDED.canonical, source = EXCLUDED.source, ror_id = EXCLUDED.ror_id`;
    return res.json({ ok: true });
  }
  if (action === "dismiss") {
    const { category, valueA, valueB } = req.body;
    if (!category || !valueA || !valueB) return res.status(400).json({ error: "Missing fields" });
    await sql`
      INSERT INTO tag_dismissed_pairs (category, value_a, value_b, tenant_id)
      VALUES (${category}, ${valueA}, ${valueB}, ${tenantId}) ON CONFLICT DO NOTHING`;
    return res.json({ ok: true });
  }
  return null;
}

async function handleSynonymDelete(req, res, tenantId) {
  const id = req.query.id;
  if (!id) return res.status(400).json({ error: "Missing id" });
  await sql`DELETE FROM tag_synonyms WHERE id = ${id} AND tenant_id = ${tenantId}`;
  return res.json({ ok: true });
}

module.exports = { handleSynonymGet, handleSynonymPost, handleSynonymDelete };

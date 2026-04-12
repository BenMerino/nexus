const { sql } = require("@vercel/postgres");
const { findCandidates } = require("./synonym-candidates");

async function handleSynonymGet(action, req, res) {
  if (action === "synonyms") {
    const { rows } = await sql`SELECT * FROM tag_synonyms ORDER BY category, canonical`;
    return res.json(rows);
  }
  if (action === "candidates") {
    const category = req.query.category || null;
    const threshold = parseFloat(req.query.threshold) || 0.7;
    return res.json(await findCandidates(category, threshold));
  }
  return null;
}

async function handleSynonymPost(action, req, res) {
  if (action === "confirm") {
    const { category, variant, canonical, source } = req.body;
    if (!category || !variant || !canonical) return res.status(400).json({ error: "Missing fields" });
    await sql`
      INSERT INTO tag_synonyms (category, variant, canonical, source)
      VALUES (${category}, ${variant}, ${canonical}, ${source || "manual"})
      ON CONFLICT(category, variant) DO UPDATE SET canonical = EXCLUDED.canonical, source = EXCLUDED.source`;
    return res.json({ ok: true });
  }
  if (action === "dismiss") {
    const { category, valueA, valueB } = req.body;
    if (!category || !valueA || !valueB) return res.status(400).json({ error: "Missing fields" });
    await sql`
      INSERT INTO tag_dismissed_pairs (category, value_a, value_b)
      VALUES (${category}, ${valueA}, ${valueB}) ON CONFLICT DO NOTHING`;
    return res.json({ ok: true });
  }
  return null;
}

async function handleSynonymDelete(req, res) {
  const id = req.query.id;
  if (!id) return res.status(400).json({ error: "Missing id" });
  await sql`DELETE FROM tag_synonyms WHERE id = ${id}`;
  return res.json({ ok: true });
}

module.exports = { handleSynonymGet, handleSynonymPost, handleSynonymDelete };

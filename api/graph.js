const { ensureSchema, getAllTags } = require("../lib/db");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  await ensureSchema();
  try {
    const tags = await getAllTags();
    const nodes = new Map();
    const edges = [];
    for (const t of tags) {
      const doiNodeId = `doi:${t.doi}`;
      const tagNodeId = `${t.category}:${t.value}`;
      if (!nodes.has(doiNodeId)) nodes.set(doiNodeId, { id: doiNodeId, label: t.title || t.doi, group: "doi" });
      if (!nodes.has(tagNodeId)) nodes.set(tagNodeId, { id: tagNodeId, label: t.value, group: t.category });
      edges.push({ source: doiNodeId, target: tagNodeId });
    }
    res.json({ nodes: Array.from(nodes.values()), edges });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

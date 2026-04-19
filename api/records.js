const { ensureSchema, getAllRecords } = require("../lib/db");
const { requireScope } = require("../lib/scope");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  await ensureSchema();
  const scope = await requireScope(req, res);
  if (!scope) return;
  try {
    const records = (await getAllRecords(scope)).map((r) => ({
      ...r,
      authors: r.authors ? JSON.parse(r.authors) : [],
      affiliations: r.affiliations ? JSON.parse(r.affiliations) : [],
    }));
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

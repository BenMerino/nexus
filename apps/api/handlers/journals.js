const { ensureSchema } = require("../src/lib/db");
const { listJournals } = require("../src/lib/db-journals");
const { requireScope } = require("../src/lib/scope");

// /api/journals — venues (journals) for the tenant, scoped. Personal-scope
// users get only venues carrying their own papers; admin sees the tenant.
module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  await ensureSchema();
  const scope = await requireScope(req, res);
  if (!scope) return;
  try {
    res.json(await listJournals(scope));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

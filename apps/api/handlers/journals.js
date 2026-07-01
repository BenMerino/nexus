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
    // This authed page still wants the full unpaginated list (journals.tsx
    // renders one flat table) — the public handler is the one that paginates.
    const { rows } = await listJournals(scope, { pageSize: 20000 });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

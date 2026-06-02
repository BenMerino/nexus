const { ensureSchema } = require("../../src/lib/db");
const { requireScope } = require("../../src/lib/scope");
const { getUiPref, setUiPref } = require("../../src/lib/db-ui-prefs");

// GET/PUT /api/user-ui-prefs/:scopeKey — per-(tenant, user) UI preference store,
// the backend for the graph-engine's `useUserUiPref` hook. Scope-gated (N1):
// the acting user reads/writes only their OWN prefs for their tenant.
//
// GET  → { scopeKey, value, updatedAt } | null   (null = never set; NOT a 404,
//        so the hook degrades to its default cleanly instead of logging an error)
// PUT  → { value } body → upsert → the persisted record
module.exports = async function handler(req, res) {
  await ensureSchema();
  const scope = await requireScope(req, res);
  if (!scope) return;

  const scopeKey = decodeURIComponent(req.query.scopeKey || "");
  if (!scopeKey) return res.status(400).json({ error: "Missing scopeKey" });

  try {
    if (req.method === "GET") {
      return res.json(await getUiPref(scope, scopeKey));
    }
    if (req.method === "PUT") {
      const value = req.body && Object.prototype.hasOwnProperty.call(req.body, "value")
        ? req.body.value
        : undefined;
      if (value === undefined) return res.status(400).json({ error: "Missing value" });
      return res.json(await setUiPref(scope, scopeKey, value));
    }
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

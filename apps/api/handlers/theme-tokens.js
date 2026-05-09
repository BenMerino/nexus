const { sql } = require("../src/lib/sql");
const { ensureSchema } = require("../src/lib/db");
const { requireScope } = require("../src/lib/scope");

const DEFAULTS = {
  "chart-heatmap-from": "#3a2a14",
  "chart-heatmap-low":  "#7a5320",
  "chart-heatmap-mid":  "#c08a35",
  "chart-heatmap-to":   "#e8c870",
};
const KEYS = Object.keys(DEFAULTS);
const HEX = /^#[0-9a-fA-F]{6}$/;

module.exports = async function handler(req, res) {
  await ensureSchema();

  if (req.method === "GET") {
    const rows = (await sql`SELECT key, value FROM theme_tokens`).rows;
    const out = { ...DEFAULTS };
    for (const r of rows) if (KEYS.includes(r.key) && HEX.test(r.value)) out[r.key] = r.value;
    return res.json(out);
  }

  if (req.method === "PUT") {
    const scope = await requireScope(req, res);
    if (!scope) return;
    if (scope.role !== "superadmin") return res.status(403).json({ error: "Superadmin required" });
    const body = req.body || {};
    const updates = Object.entries(body).filter(([k, v]) => KEYS.includes(k) && typeof v === "string" && HEX.test(v));
    if (!updates.length) return res.status(400).json({ error: "No valid token updates" });
    for (const [k, v] of updates) {
      await sql`INSERT INTO theme_tokens (key, value, updated_at) VALUES (${k}, ${v}, NOW())
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
    }
    return res.json({ updated: updates.length });
  }

  res.status(405).json({ error: "Method not allowed" });
};

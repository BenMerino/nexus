const { ensureSchema, setSetting } = require("../lib/db");
const { getUser } = require("../lib/auth");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!getUser(req)) return res.status(401).json({ error: "Not authenticated" });

  await ensureSchema();
  const { data } = req.body;
  if (!data || !data.startsWith("data:image/")) {
    return res.status(400).json({ error: "Invalid image data" });
  }

  await setSetting("tenant_logo", data);
  res.json({ ok: true });
};

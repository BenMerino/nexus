const { ensureSchema, getSetting } = require("../lib/db");
const { getUser } = require("../lib/auth");

const TENANT_NAME = "Universidad de Talca";

module.exports = async function handler(req, res) {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "Not authenticated" });

  await ensureSchema();
  const logo = await getSetting("tenant_logo");
  res.json({ user, tenant: TENANT_NAME, logo });
};

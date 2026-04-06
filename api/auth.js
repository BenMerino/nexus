const { ensureSchema, getSetting, setSetting } = require("../lib/db");
const { getUser } = require("../lib/auth");

const VALID_USER = "hquinteros";
const VALID_PASS = "hectorben2026";
const TENANT_NAME = "Universidad de Talca";

const USER_PROFILE = {
  name: "Héctor Quinteros Lama",
  position: "Vicerrector",
  faculty: "Facultad de Ingeniería",
  affiliation: TENANT_NAME,
  titles: ["Dr.", "Prof."],
};

module.exports = async function handler(req, res) {
  const action = req.query.action;

  // GET /api/auth?action=me
  if (req.method === "GET" && action === "me") {
    const user = getUser(req);
    if (!user) return res.status(401).json({ error: "Not authenticated" });
    await ensureSchema();
    const logo = await getSetting("tenant_logo");
    return res.json({ user, tenant: TENANT_NAME, logo, profile: USER_PROFILE });
  }

  // GET /api/auth?action=logout
  if (req.method === "GET" && action === "logout") {
    res.setHeader("Set-Cookie", [
      "nexus_user=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
      "nexus_logged_in=; Path=/; SameSite=Lax; Max-Age=0",
    ]);
    res.writeHead(302, { Location: "/login.html" });
    return res.end();
  }

  // POST /api/auth?action=login
  if (req.method === "POST" && action === "login") {
    const { user, pass } = req.body;
    if (!user || !pass) return res.status(400).json({ error: "Username and password required" });
    if (user !== VALID_USER || pass !== VALID_PASS) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    res.setHeader("Set-Cookie", [
      `nexus_user=${user}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`,
      `nexus_logged_in=1; Path=/; SameSite=Lax; Max-Age=604800`,
    ]);
    return res.json({ ok: true, user });
  }

  // POST /api/auth?action=upload-logo
  if (req.method === "POST" && action === "upload-logo") {
    if (!getUser(req)) return res.status(401).json({ error: "Not authenticated" });
    await ensureSchema();
    const { data } = req.body;
    if (!data || !data.startsWith("data:image/")) {
      return res.status(400).json({ error: "Invalid image data" });
    }
    await setSetting("tenant_logo", data);
    return res.json({ ok: true });
  }

  res.status(404).json({ error: "Unknown action" });
};

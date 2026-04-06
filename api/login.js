const VALID_USER = "hquinteros";
const VALID_PASS = "hectorben2026";

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { user, pass } = req.body;
  if (!user || !pass) return res.status(400).json({ error: "Username and password required" });

  if (user !== VALID_USER || pass !== VALID_PASS) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  res.setHeader("Set-Cookie", [
    `nexus_user=${user}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`,
    `nexus_logged_in=1; Path=/; SameSite=Lax; Max-Age=604800`,
  ]);
  res.json({ ok: true, user });
};

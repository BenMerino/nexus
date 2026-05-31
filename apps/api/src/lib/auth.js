const crypto = require("crypto");
const { getUserById } = require("./db-users");

const SECRET = process.env.SESSION_SECRET || "nexus-dev-secret-change-me";

function sign(payload) {
  const data = encodeURIComponent(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", SECRET).update(data).digest("hex");
  return data + "." + sig;
}

function verify(raw) {
  const dot = raw.lastIndexOf(".");
  if (dot === -1) return null;
  const data = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const expected = crypto.createHmac("sha256", SECRET).update(data).digest("hex");
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try { return JSON.parse(decodeURIComponent(data)); } catch { return null; }
}

function makeSessionCookie(user) {
  const payload = { id: user.id, username: user.username };
  const signed = sign(payload);
  return [
    `nexus_user=${signed}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`,
    `nexus_logged_in=1; Path=/; SameSite=Lax; Max-Age=604800`,
  ];
}

function getUser(req) {
  const cookie = req.headers.cookie || "";
  const match = cookie.match(/nexus_user=([^;]+)/);
  if (!match) return null;
  return verify(match[1]);
}

async function requireRole(req, ...roles) {
  const session = getUser(req);
  if (!session || !session.id) return null;
  const user = await getUserById(session.id);
  if (!user || !user.active) return null;
  if (roles.length && !roles.includes(user.role)) return null;
  return { id: user.id, username: user.username, role: user.role, tenantId: user.tenant_id };
}

// Administrative roles plus the tenant_admin capability flag. tenant_admin is
// separate from role (e.g. an `academic` who also administers their tenant —
// Héctor Quinteros) and must grant the same management access as an editor role.
const EDITOR_ROLES = ["secretary", "director", "admin", "superadmin"];
async function requireEditor(req) {
  const session = getUser(req);
  if (!session || !session.id) return null;
  const user = await getUserById(session.id);
  if (!user || !user.active) return null;
  if (!EDITOR_ROLES.includes(user.role) && user.tenant_admin !== true) return null;
  return { id: user.id, username: user.username, role: user.role, tenantId: user.tenant_id };
}

module.exports = { getUser, requireRole, requireEditor, makeSessionCookie };

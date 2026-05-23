const { ensureSchema, getAllRecords } = require("../lib/db");
const { getUser, requireRole, makeSessionCookie } = require("../lib/auth");
const { getUserByUsername, getUserById, listTenants, listSubtenants, listUsers, createUser, updateUser, updateTenant, createTenant } = require("../lib/db-users");
const { seedUsers } = require("../lib/seed-users");
const { buildProfile, computeHIndex, countPapersByOrcid, countPapersByRor, researcherNameByOrcid } = require("../lib/auth-helpers");
const { getScope } = require("../lib/scope");

module.exports = async function handler(req, res) {
  await ensureSchema();
  await seedUsers();
  const action = req.query.action;

  if (req.method === "GET" && action === "me") {
    const session = getUser(req);
    if (!session) return res.status(401).json({ error: "Not authenticated" });
    const user = await getUserById(session.id);
    if (!user) return res.status(401).json({ error: "User not found" });
    const isSuperadmin = user.role === "superadmin";
    const tid = user.tenant_id || 1;
    const scope = !isSuperadmin ? await getScope(req) : null;
    const [tenants, hIndexResult, userPapers, researcherName] = await Promise.all([
      listTenants(),
      (!isSuperadmin && user.full_name && scope) ? getAllRecords(scope).then(r => computeHIndex(user, r)) : null,
      countPapersByOrcid(user.orcid, tid),
      researcherNameByOrcid(user.orcid, tid),
    ]);
    const tenant = tenants.find(t => t.id === user.tenant_id);
    const tenantPapers = await countPapersByRor(tenant?.ror_id, tid);
    const profile = buildProfile(user, tenant);
    if (researcherName) profile.researcherName = researcherName;
    return res.json({
      user: user.username, tenant: tenant?.name,
      logo: isSuperadmin ? null : tenant?.logo_url,
      profile,
      hIndex: hIndexResult?.hIndex ?? null,
      hIndexByType: hIndexResult?.byType ?? null,
      userPapers, tenantPapers,
      role: user.role, tenantId: user.tenant_id,
      primaryColor: isSuperadmin ? null : tenant?.primary_color,
      secondaryColor: isSuperadmin ? null : tenant?.secondary_color,
    });
  }

  if (req.method === "GET" && action === "logout") {
    res.setHeader("Set-Cookie", [
      "nexus_user=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
      "nexus_logged_in=; Path=/; SameSite=Lax; Max-Age=0",
    ]);
    res.writeHead(302, { Location: "/login.html" });
    return res.end();
  }

  if (req.method === "POST" && action === "login") {
    const { user, pass } = req.body;
    if (!user || !pass) return res.status(400).json({ error: "Username and password required" });
    const dbUser = await getUserByUsername(user);
    if (!dbUser || dbUser.password !== pass) return res.status(401).json({ error: "Invalid credentials" });
    res.setHeader("Set-Cookie", makeSessionCookie(dbUser));
    return res.json({ ok: true, user: dbUser.username, role: dbUser.role });
  }

  if (req.method === "POST" && action === "upload-logo") {
    const session = await requireRole(req, "superadmin");
    if (!session) return res.status(403).json({ error: "Superadmin required" });
    const { data, tenantId } = req.body;
    if (!data?.startsWith("data:image/")) return res.status(400).json({ error: "Invalid image" });
    await updateTenant(tenantId || session.tenantId, { logo_url: data });
    return res.json({ ok: true });
  }

  // --- Superadmin-only actions ---
  if (action === "tenants") {
    const sa = await requireRole(req, "superadmin");
    if (!sa) return res.status(403).json({ error: "Superadmin required" });
    if (req.method === "GET") return res.json(await listTenants());
    if (req.method === "POST") {
      const { name, ror_id, parent_id, slug } = req.body;
      if (!ror_id) return res.status(400).json({ error: "ROR ID is required" });
      const id = await createTenant(name, ror_id, parent_id, slug);
      return res.json({ ok: true, id });
    }
    if (req.method === "PUT") {
      const { id, ...fields } = req.body;
      await updateTenant(id, fields);
      return res.json({ ok: true });
    }
  }

  if (action === "users") {
    const sa = await requireRole(req, "superadmin");
    if (!sa) return res.status(403).json({ error: "Superadmin required" });
    const tid = req.query.tenantId ? parseInt(req.query.tenantId) : null;
    if (req.method === "GET") return res.json(await listUsers(tid));
    if (req.method === "POST") {
      const { username, password, full_name, email, role, tenant_id, position, faculty, titles, orcid, department, profile_category } = req.body;
      const id = await createUser(username, password, full_name, email, role, tenant_id || tid, position, faculty, titles, orcid, department, profile_category);
      return res.json({ ok: true, id });
    }
    if (req.method === "PUT") {
      const { id, ...fields } = req.body;
      await updateUser(id, fields);
      return res.json({ ok: true });
    }
  }

  if (action === "users-import") {
    const sa = await requireRole(req, "superadmin");
    if (!sa) return res.status(403).json({ error: "Superadmin required" });
    if (req.method === "POST") {
      const { csv, tenant_id } = req.body;
      const tid = tenant_id || (req.query.tenantId ? parseInt(req.query.tenantId) : null);
      if (!csv || !tid) return res.status(400).json({ error: "csv and tenant_id are required" });
      const { parseRoster, importRoster } = require("../lib/roster-import");
      const rows = parseRoster(csv);
      const result = await importRoster(rows, tid);
      return res.json({ ok: true, parsed: rows.length, ...result });
    }
  }

  res.status(404).json({ error: "Unknown action" });
};

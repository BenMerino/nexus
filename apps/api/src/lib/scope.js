const { getUser } = require("./auth");
const { getUserById, listTenants } = require("./db-users");

/**
 * Extract tenant/user scope from request.
 * Every API that reads data MUST call this and pass the scope to db functions.
 */
async function getScope(req) {
  const session = getUser(req);
  if (!session?.id) return null;
  const user = await getUserById(session.id);
  if (!user) return null;
  const tenants = await listTenants();
  const tenant = tenants.find(t => t.id === user.tenant_id);
  return {
    tenantId: user.tenant_id || 1,
    orcid: user.orcid || null,
    ror: tenant?.ror_id || null,
    role: user.role,
    userId: user.id,
    username: user.username,
    tenantAdmin: user.tenant_admin === true,
  };
}

/** Returns scope or sends 401 and returns null */
async function requireScope(req, res) {
  const scope = await getScope(req);
  if (!scope) { res.status(401).json({ error: "Not authenticated" }); return null; }
  return scope;
}

/** True when scope should see only their own papers (non-admin with ORCID) */
function isPersonalScope(scope) {
  return scope.role !== "superadmin" && scope.role !== "admin" && !!scope.orcid;
}

module.exports = { getScope, requireScope, isPersonalScope };

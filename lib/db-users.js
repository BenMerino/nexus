const { sql } = require("@vercel/postgres");

async function getUserByUsername(username) {
  const r = await sql`SELECT * FROM users WHERE username = ${username} AND active = TRUE`;
  return r.rows[0] || null;
}

async function getUserById(id) {
  const r = await sql`SELECT * FROM users WHERE id = ${id}`;
  return r.rows[0] || null;
}

async function listUsers(tenantId) {
  if (tenantId) {
    const r = await sql`SELECT id, username, full_name, email, role, tenant_id, position, faculty, titles, active FROM users WHERE tenant_id = ${tenantId} ORDER BY full_name`;
    return r.rows;
  }
  const r = await sql`SELECT u.id, u.username, u.full_name, u.email, u.role, u.tenant_id, u.position, u.active, t.name as tenant_name FROM users u LEFT JOIN tenants t ON u.tenant_id = t.id ORDER BY u.id`;
  return r.rows;
}

async function createUser(username, password, fullName, email, role, tenantId, position, faculty, titles) {
  const r = await sql`
    INSERT INTO users (username, password, full_name, email, role, tenant_id, position, faculty, titles)
    VALUES (${username}, ${password}, ${fullName}, ${email}, ${role}, ${tenantId}, ${position}, ${faculty}, ${titles})
    RETURNING id`;
  return r.rows[0].id;
}

async function updateUser(id, fields) {
  const u = await getUserById(id);
  if (!u) return null;
  await sql`
    UPDATE users SET
      full_name = ${fields.full_name ?? u.full_name},
      email = ${fields.email ?? u.email},
      role = ${fields.role ?? u.role},
      position = ${fields.position ?? u.position},
      faculty = ${fields.faculty ?? u.faculty},
      titles = ${fields.titles ?? u.titles},
      active = ${fields.active ?? u.active}
    WHERE id = ${id}`;
  return true;
}

async function listTenants() {
  const r = await sql`SELECT * FROM tenants ORDER BY id`;
  return r.rows;
}

async function updateTenant(id, fields) {
  const r = await sql`SELECT * FROM tenants WHERE id = ${id}`;
  const t = r.rows[0];
  if (!t) return null;
  await sql`
    UPDATE tenants SET
      name = ${fields.name ?? t.name},
      ror_id = ${fields.ror_id ?? t.ror_id},
      logo_url = ${fields.logo_url ?? t.logo_url},
      primary_color = ${fields.primary_color ?? t.primary_color},
      secondary_color = ${fields.secondary_color ?? t.secondary_color},
      active = ${fields.active ?? t.active}
    WHERE id = ${id}`;
  return true;
}

async function createTenant(name, rorId) {
  const r = await sql`
    INSERT INTO tenants (name, ror_id) VALUES (${name}, ${rorId}) RETURNING id`;
  return r.rows[0].id;
}

module.exports = {
  getUserByUsername, getUserById, listUsers,
  createUser, updateUser, listTenants, updateTenant, createTenant,
};

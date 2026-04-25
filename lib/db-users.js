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
    const r = await sql`SELECT id, username, full_name, email, role, tenant_id, position, faculty, titles, orcid, active, grado_academico, horas_permanencia FROM users WHERE tenant_id = ${tenantId} ORDER BY full_name`;
    return r.rows;
  }
  const r = await sql`SELECT u.id, u.username, u.full_name, u.email, u.role, u.tenant_id, u.position, u.orcid, u.active, u.grado_academico, u.horas_permanencia, t.name as tenant_name FROM users u LEFT JOIN tenants t ON u.tenant_id = t.id ORDER BY u.id`;
  return r.rows;
}

async function createUser(username, password, fullName, email, role, tenantId, position, faculty, titles, orcid) {
  const r = await sql`
    INSERT INTO users (username, password, full_name, email, role, tenant_id, position, faculty, titles, orcid)
    VALUES (${username}, ${password}, ${fullName}, ${email}, ${role}, ${tenantId}, ${position}, ${faculty}, ${titles}, ${orcid || null})
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
      orcid = ${fields.orcid ?? u.orcid},
      active = ${fields.active ?? u.active},
      grado_academico = ${fields.grado_academico ?? u.grado_academico},
      horas_permanencia = ${fields.horas_permanencia ?? u.horas_permanencia}
    WHERE id = ${id}`;
  return true;
}

async function listTenants() {
  const r = await sql`SELECT t.*, p.name AS parent_name FROM tenants t LEFT JOIN tenants p ON t.parent_id = p.id ORDER BY COALESCE(t.parent_id, t.id), t.parent_id NULLS FIRST, t.id`;
  return r.rows;
}

async function listSubtenants(parentId) {
  const r = await sql`SELECT * FROM tenants WHERE parent_id = ${parentId} ORDER BY name`;
  return r.rows;
}

function normalizeSlug(raw) {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  return s.length ? s : null;
}

async function updateTenant(id, fields) {
  const r = await sql`SELECT * FROM tenants WHERE id = ${id}`;
  const t = r.rows[0];
  if (!t) return null;
  const parentId = fields.parent_id !== undefined ? fields.parent_id : t.parent_id;
  const slug = fields.slug !== undefined ? normalizeSlug(fields.slug) : t.slug;
  await sql`
    UPDATE tenants SET
      name = ${fields.name ?? t.name},
      parent_id = ${parentId},
      ror_id = ${fields.ror_id ?? t.ror_id},
      logo_url = ${fields.logo_url ?? t.logo_url},
      primary_color = ${fields.primary_color ?? t.primary_color},
      secondary_color = ${fields.secondary_color ?? t.secondary_color},
      slug = ${slug},
      active = ${fields.active ?? t.active}
    WHERE id = ${id}`;
  return true;
}

async function createTenant(name, rorId, parentId, slug) {
  const pid = parentId || null;
  const s = normalizeSlug(slug);
  const r = await sql`
    INSERT INTO tenants (name, ror_id, parent_id, slug) VALUES (${name}, ${rorId}, ${pid}, ${s}) RETURNING id`;
  return r.rows[0].id;
}

async function getTenantBySlug(slug) {
  const s = normalizeSlug(slug);
  if (!s) return null;
  const r = await sql`SELECT * FROM tenants WHERE slug = ${s} AND active = TRUE`;
  return r.rows[0] || null;
}

module.exports = {
  getUserByUsername, getUserById, listUsers,
  createUser, updateUser, listTenants, listSubtenants, updateTenant, createTenant,
  getTenantBySlug, normalizeSlug,
};

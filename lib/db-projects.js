const { sql } = require("@vercel/postgres");
const { normalizeKey } = require("./normalize-name");

const PROJECT_FIELDS = [
  "titulo", "fuente_financiamiento", "concursable", "externo", "monto",
  "fecha_inicio", "fecha_fin", "codigo", "departamento", "notas",
];

async function listProjects(tenantId) {
  const r = await sql`
    SELECT p.*, COALESCE(json_agg(
      json_build_object(
        'id', pi.id, 'rol', pi.rol, 'full_name', pi.full_name,
        'orcid', pi.orcid, 'user_id', pi.user_id, 'matched_by', pi.matched_by
      ) ORDER BY pi.rol, pi.full_name
    ) FILTER (WHERE pi.id IS NOT NULL), '[]'::json) AS investigators
    FROM projects p
    LEFT JOIN project_investigators pi ON pi.project_id = p.id
    WHERE p.tenant_id = ${tenantId}
    GROUP BY p.id
    ORDER BY p.fecha_inicio DESC NULLS LAST, p.id DESC`;
  return r.rows;
}

async function getProject(id, tenantId) {
  const r = await sql`
    SELECT p.*, COALESCE(json_agg(
      json_build_object(
        'id', pi.id, 'rol', pi.rol, 'full_name', pi.full_name,
        'orcid', pi.orcid, 'user_id', pi.user_id, 'matched_by', pi.matched_by
      ) ORDER BY pi.rol, pi.full_name
    ) FILTER (WHERE pi.id IS NOT NULL), '[]'::json) AS investigators
    FROM projects p
    LEFT JOIN project_investigators pi ON pi.project_id = p.id
    WHERE p.id = ${id} AND p.tenant_id = ${tenantId}
    GROUP BY p.id`;
  return r.rows[0] || null;
}

async function resolveInvestigator(tenantId, { full_name, orcid }) {
  if (orcid) {
    const r = await sql`SELECT id FROM users WHERE orcid = ${orcid} AND tenant_id = ${tenantId} LIMIT 1`;
    if (r.rows[0]) return { user_id: r.rows[0].id, matched_by: "orcid" };
  }
  if (full_name) {
    const target = normalizeKey(full_name);
    if (target) {
      const r = await sql`SELECT id, full_name FROM users WHERE tenant_id = ${tenantId} AND full_name IS NOT NULL`;
      const matches = r.rows.filter((u) => normalizeKey(u.full_name) === target);
      if (matches.length === 1) return { user_id: matches[0].id, matched_by: "name" };
    }
  }
  return { user_id: null, matched_by: null };
}

async function insertInvestigators(projectId, tenantId, investigators) {
  for (const inv of investigators || []) {
    const rol = inv.rol === "IR" ? "IR" : "CO";
    const fullName = (inv.full_name || "").trim();
    const orcid = (inv.orcid || "").trim() || null;
    if (!fullName) continue;
    const { user_id, matched_by } = await resolveInvestigator(tenantId, { full_name: fullName, orcid });
    await sql`
      INSERT INTO project_investigators (project_id, rol, full_name, orcid, user_id, matched_by)
      VALUES (${projectId}, ${rol}, ${fullName}, ${orcid}, ${user_id}, ${matched_by})`;
  }
}

async function createProject(tenantId, fields, investigators, createdById) {
  const f = pick(fields);
  const r = await sql`
    INSERT INTO projects (tenant_id, titulo, fuente_financiamiento, concursable, externo, monto,
      fecha_inicio, fecha_fin, codigo, departamento, notas, created_by)
    VALUES (${tenantId}, ${f.titulo}, ${f.fuente_financiamiento}, ${f.concursable}, ${f.externo},
      ${f.monto}, ${f.fecha_inicio}, ${f.fecha_fin}, ${f.codigo}, ${f.departamento}, ${f.notas},
      ${createdById || null})
    RETURNING id`;
  const id = r.rows[0].id;
  await insertInvestigators(id, tenantId, investigators);
  return id;
}

async function updateProject(id, tenantId, fields, investigators) {
  const cur = await getProject(id, tenantId);
  if (!cur) return false;
  const f = pick(fields, cur);
  await sql`
    UPDATE projects SET
      titulo = ${f.titulo}, fuente_financiamiento = ${f.fuente_financiamiento},
      concursable = ${f.concursable}, externo = ${f.externo}, monto = ${f.monto},
      fecha_inicio = ${f.fecha_inicio}, fecha_fin = ${f.fecha_fin},
      codigo = ${f.codigo}, departamento = ${f.departamento}, notas = ${f.notas}
    WHERE id = ${id} AND tenant_id = ${tenantId}`;
  if (Array.isArray(investigators)) {
    await sql`DELETE FROM project_investigators WHERE project_id = ${id}`;
    await insertInvestigators(id, tenantId, investigators);
  }
  return true;
}

async function deleteProject(id, tenantId) {
  const r = await sql`DELETE FROM projects WHERE id = ${id} AND tenant_id = ${tenantId}`;
  return r.rowCount > 0;
}

function pick(fields, fallback = {}) {
  const out = {};
  for (const k of PROJECT_FIELDS) {
    out[k] = fields[k] !== undefined ? fields[k] : fallback[k] ?? null;
  }
  if (out.concursable === undefined || out.concursable === null) out.concursable = true;
  if (out.externo === undefined || out.externo === null) out.externo = true;
  return out;
}

module.exports = {
  listProjects, getProject, createProject, updateProject, deleteProject, resolveInvestigator,
};

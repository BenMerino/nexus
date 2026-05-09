const { sql } = require("./sql");
const { getSetting, setSetting } = require("./db");
const { listSourceIds } = require("./indexation-sources");
const { doctorReason, magAcadReason, magProfReason } = require("./claustro-reasons");

const NUCLEO_ROLES = ["academic", "director"];
const DEFAULT_INDICES = ["WoS", "Scopus", "SciELO"];
const WINDOW_YEARS = 5;
const MIN_PERCENT_QUALIFIED = 0.7;
const MIN_AVG_HOURS = 22;
const MIN_DOCTORADO = 7;
const MIN_MAGISTER = 4;

async function getAcceptedIndices(tenantId) {
  const raw = await getSetting(`claustro.indices.${tenantId}`);
  let parsed = null;
  if (raw) try { parsed = JSON.parse(raw); } catch { parsed = null; }
  const valid = new Set(listSourceIds());
  const list = Array.isArray(parsed) ? parsed.filter((x) => valid.has(x)) : DEFAULT_INDICES;
  return list.length ? list : DEFAULT_INDICES;
}

async function setAcceptedIndices(tenantId, indices) {
  const valid = new Set(listSourceIds());
  const clean = (Array.isArray(indices) ? indices : []).filter((x) => valid.has(x));
  await setSetting(`claustro.indices.${tenantId}`, JSON.stringify(clean));
  return clean;
}

async function getClaustroForTenant(tenantId, { now = new Date() } = {}) {
  const usersR = await sql`
    SELECT id, full_name, orcid, role, position, faculty,
           grado_academico, horas_permanencia
    FROM users
    WHERE tenant_id = ${tenantId} AND active = TRUE AND role = ANY(${NUCLEO_ROLES})
    ORDER BY full_name`;
  const users = usersR.rows;
  if (!users.length) return [];

  const indices = await getAcceptedIndices(tenantId);
  const minYear = now.getFullYear() - WINDOW_YEARS + 1;
  const orcids = users.map((u) => u.orcid).filter(Boolean);
  const userIds = users.map((u) => u.id);

  const pubByOrcid = new Map();
  if (orcids.length) {
    const r = await sql.query(
      `SELECT t_author.ext_id AS orcid, COUNT(DISTINCT d.id)::int AS pub_count
       FROM doi_records d
       JOIN tags t_author ON t_author.doi_record_id = d.id AND t_author.category = 'author'
       JOIN tags t_idx ON t_idx.doi_record_id = d.id AND t_idx.category = 'indexed_in'
       WHERE d.tenant_id = $1
         AND t_author.ext_id = ANY($2::text[])
         AND t_idx.value = ANY($3::text[])
         AND d.published ~ '^[0-9]{4}'
         AND SUBSTRING(d.published FROM 1 FOR 4)::int >= $4
       GROUP BY t_author.ext_id`,
      [tenantId, orcids, indices, minYear]
    );
    for (const row of r.rows) pubByOrcid.set(row.orcid, row.pub_count);
  }

  const projByUser = new Map();
  if (userIds.length) {
    const today = toDateStr(now);
    const fromDate = toDateStr(new Date(now.getFullYear() - WINDOW_YEARS, now.getMonth(), now.getDate()));
    const r = await sql.query(
      `SELECT pi.user_id,
              COUNT(*) FILTER (WHERE pi.rol = 'IR' AND p.concursable AND p.externo)::int AS ir_externo,
              COUNT(*) FILTER (WHERE p.concursable)::int AS concursable_any
       FROM project_investigators pi
       JOIN projects p ON p.id = pi.project_id
       WHERE p.tenant_id = $1
         AND pi.user_id = ANY($2::int[])
         AND p.fecha_inicio IS NOT NULL AND p.fecha_fin IS NOT NULL
         AND p.fecha_inicio <= $3 AND p.fecha_fin >= $4
       GROUP BY pi.user_id`,
      [tenantId, userIds, today, fromDate]
    );
    for (const row of r.rows) projByUser.set(row.user_id, row);
  }

  return users.map((u) => {
    const pubCount = (u.orcid && pubByOrcid.get(u.orcid)) || 0;
    const proj = projByUser.get(u.id) || { ir_externo: 0, concursable_any: 0 };
    const evidence = { pubCount, irExterno: proj.ir_externo, concursableAny: proj.concursable_any };
    return { user: u, evidence, ...classifyAcademic(u, evidence) };
  });
}

function classifyAcademic(user, { pubCount, irExterno, concursableAny }) {
  const grado = user.grado_academico;
  const hasMagOrDoc = grado === "Doctor" || grado === "Magíster";
  const reasons = {};
  const doctorado = grado === "Doctor" && pubCount >= 5 && irExterno >= 1;
  if (!doctorado) reasons.doctorado = doctorReason(grado, pubCount, irExterno);
  const magister_academico = hasMagOrDoc && pubCount >= 2 && concursableAny >= 1;
  if (!magister_academico) reasons.magister_academico = magAcadReason(hasMagOrDoc, pubCount, concursableAny);
  const magister_profesional = hasMagOrDoc && pubCount >= 1;
  if (!magister_profesional) reasons.magister_profesional = magProfReason(hasMagOrDoc, pubCount);
  return { classification: { doctorado, magister_academico, magister_profesional }, reasons };
}

function validateProgram(claustro, programType) {
  const key = programType === "doctorado" ? "doctorado"
    : programType === "magister_academico" ? "magister_academico"
    : "magister_profesional";
  const minRequired = key === "doctorado" ? MIN_DOCTORADO : MIN_MAGISTER;
  const total = claustro.length;
  const qualifiedItems = claustro.filter((c) => c.classification[key]);
  const qualified = qualifiedItems.length;
  const percentQualified = total ? qualified / total : 0;
  const hours = qualifiedItems.map((c) => Number(c.user.horas_permanencia)).filter((n) => Number.isFinite(n));
  const averageHours = hours.length ? hours.reduce((a, b) => a + b, 0) / hours.length : 0;
  const meetsPercent = percentQualified >= MIN_PERCENT_QUALIFIED;
  const meetsCount = qualified >= minRequired;
  const meetsHours = averageHours >= MIN_AVG_HOURS;
  return {
    program: key, total, qualified, percentQualified, minRequired,
    averageHours, meetsPercent, meetsCount, meetsHours,
    pass: meetsPercent && meetsCount && meetsHours,
  };
}

function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

module.exports = {
  getClaustroForTenant, classifyAcademic, validateProgram,
  getAcceptedIndices, setAcceptedIndices,
};

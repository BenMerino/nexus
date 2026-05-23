const { sql } = require("./sql");
const crypto = require("crypto");

// The roster CSVs arrive as Latin-1 bytes that were mis-decoded as UTF-8
// (e.g. "DiseÃ±o" instead of "Diseño"). Re-interpret the mojibake back to UTF-8.
function fixMojibake(s) {
  if (!s || !/Ã|Â/.test(s)) return s;
  try {
    return Buffer.from(s, "latin1").toString("utf8");
  } catch {
    return s;
  }
}

// Locate a column index by trying several header aliases (accent/case
// insensitive). Returns -1 if none match.
function findCol(headers, aliases) {
  const norm = (s) => fixMojibake(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const H = headers.map(norm);
  for (const a of aliases) {
    const i = H.indexOf(norm(a));
    if (i !== -1) return i;
  }
  return -1;
}

// Parse a semicolon-delimited roster export with a header row. Columns are
// matched by header name (not position), so an optional ORCID column can
// appear anywhere — or be absent. Returns
// [{ fullName, profileCategory, department, faculty, orcid }].
function parseRoster(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
  if (lines.length < 2) return [];
  const headers = lines[0].split(";");
  const ci = {
    name: findCol(headers, ["Nombre", "Name", "Full Name"]),
    category: findCol(headers, ["Categoría/Familia de Perfil", "Categoria", "Category"]),
    department: findCol(headers, ["Departamento / Unidad", "Departamento", "Department"]),
    faculty: findCol(headers, ["Facultad", "Faculty"]),
    orcid: findCol(headers, ["ORCID", "Orcid", "ORCID iD"]),
  };
  // Fall back to legacy positional layout (name;category;department;faculty)
  // when the name header isn't recognized.
  if (ci.name === -1) { ci.name = 0; ci.category = 1; ci.department = 2; ci.faculty = 3; }

  const get = (cols, idx) => (idx >= 0 ? fixMojibake((cols[idx] || "").trim()) : "");
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(";");
    const fullName = get(cols, ci.name);
    if (!fullName) continue;
    rows.push({
      fullName,
      profileCategory: get(cols, ci.category) || null,
      department: get(cols, ci.department) || null,
      faculty: get(cols, ci.faculty) || null,
      orcid: (get(cols, ci.orcid) || "").replace("https://orcid.org/", "") || null,
    });
  }
  return rows;
}

function baseSlug(name) {
  const base = (name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/(^\.|\.$)/g, "");
  return base || "academico";
}

// Import roster rows as academic users under one tenant.
// Idempotent on (tenant_id, full_name): existing rows are updated in place
// (org fields only — username/password are never reset).
async function importRoster(rows, tenantId) {
  const result = { created: 0, updated: 0, errors: [], credentials: [] };
  const usedSlugs = new Set();

  for (const r of rows) {
    try {
      const existing = await sql`
        SELECT id, orcid FROM users WHERE tenant_id = ${tenantId} AND full_name = ${r.fullName} LIMIT 1`;
      if (existing.rows[0]) {
        // Backfill orcid only when the row doesn't already have one — never
        // overwrite an orcid a user may have claimed since the last import.
        const keepOrcid = existing.rows[0].orcid || r.orcid || null;
        await sql`
          UPDATE users SET
            department = ${r.department},
            faculty = ${r.faculty},
            profile_category = ${r.profileCategory},
            orcid = ${keepOrcid}
          WHERE id = ${existing.rows[0].id}`;
        result.updated++;
        continue;
      }

      let slug = baseSlug(r.fullName);
      let candidate = slug;
      let n = 1;
      while (usedSlugs.has(candidate) || (await usernameTaken(candidate))) {
        candidate = `${slug}.${++n}`;
      }
      usedSlugs.add(candidate);

      const tempPassword = crypto.randomBytes(9).toString("base64url");
      await sql`
        INSERT INTO users (username, password, full_name, role, tenant_id, active, department, faculty, profile_category, orcid)
        VALUES (${candidate}, ${tempPassword}, ${r.fullName}, 'academic', ${tenantId}, TRUE, ${r.department}, ${r.faculty}, ${r.profileCategory}, ${r.orcid})`;
      result.created++;
      result.credentials.push({ username: candidate, password: tempPassword, fullName: r.fullName });
    } catch (err) {
      result.errors.push({ fullName: r.fullName, error: err.message });
    }
  }
  return result;
}

async function usernameTaken(username) {
  const r = await sql`SELECT 1 FROM users WHERE username = ${username} LIMIT 1`;
  return !!r.rows[0];
}

module.exports = { parseRoster, importRoster, fixMojibake };

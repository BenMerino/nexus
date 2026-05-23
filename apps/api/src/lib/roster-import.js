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

// Parse a semicolon-delimited roster export with a header row.
// Returns [{ fullName, profileCategory, department, faculty }].
function parseRoster(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
  if (!lines.length) return [];
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(";");
    const fullName = fixMojibake((cols[0] || "").trim());
    if (!fullName) continue;
    rows.push({
      fullName,
      profileCategory: fixMojibake((cols[1] || "").trim()) || null,
      department: fixMojibake((cols[2] || "").trim()) || null,
      faculty: fixMojibake((cols[3] || "").trim()) || null,
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
        SELECT id FROM users WHERE tenant_id = ${tenantId} AND full_name = ${r.fullName} LIMIT 1`;
      if (existing.rows[0]) {
        await sql`
          UPDATE users SET
            department = ${r.department},
            faculty = ${r.faculty},
            profile_category = ${r.profileCategory}
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
        INSERT INTO users (username, password, full_name, role, tenant_id, active, department, faculty, profile_category)
        VALUES (${candidate}, ${tempPassword}, ${r.fullName}, 'academic', ${tenantId}, TRUE, ${r.department}, ${r.faculty}, ${r.profileCategory})`;
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

const crypto = require("crypto");
const { sql } = require("./sql");
const { getUserByUsername, createUser } = require("./db-users");
const { hashPassword } = require("./passwords");

let _seeded = null;

async function seedUsers() {
  if (!_seeded) _seeded = _doSeed().catch(err => { _seeded = null; throw err; });
  return _seeded;
}

async function _doSeed() {
  // Rename old usernames to email format
  const renames = [
    ["hquinteros", "hectorquinteros@utalca.cl"],
    ["secretaria.utalca", "secretaria@utalca.cl"],
    // Old superadmin login retired in favor of superadmin@dev. Carry the
    // existing row over so there's a single superadmin account, not two.
    ["superadmin", "superadmin@dev"],
  ];
  for (const [old, nu] of renames) {
    const existing = await getUserByUsername(old);
    if (existing) {
      await sql`UPDATE users SET username = ${nu} WHERE username = ${old}`;
    }
  }

  // Passwords are never sourced from code. The superadmin password can be
  // rotated via SEED_SUPERADMIN_PASSWORD; users created on a fresh DB get a
  // random one-time password printed to the boot log.
  const superPw = process.env.SEED_SUPERADMIN_PASSWORD;
  if (superPw) {
    await sql`UPDATE users SET password = ${await hashPassword(superPw)} WHERE username = 'superadmin@dev'`;
  }

  const seeds = [
    {
      username: "superadmin@dev", password: superPw,
      fullName: "Super Admin", role: "superadmin", tenantId: null,
      position: "Platform Administrator", faculty: null, titles: null,
    },
    {
      username: "hectorquinteros@utalca.cl",
      fullName: "Héctor Quinteros Lama", role: "academic", tenantId: 1,
      position: "Director de Investigación", faculty: "Facultad de Tecnologías Industriales",
      titles: JSON.stringify(["Dr.", "Prof."]),
      orcid: "0000-0001-8953-6140", tenantAdmin: true, syncRole: true,
    },
    {
      username: "secretaria@utalca.cl",
      fullName: "Secretaría UTalca", role: "secretary", tenantId: 1,
      position: "Secretaria Académica", faculty: "Facultad de Ingeniería",
      titles: null,
    },
  ];

  for (const s of seeds) {
    const existing = await getUserByUsername(s.username);
    if (!existing) {
      const pw = s.password || crypto.randomBytes(9).toString("base64url");
      if (!s.password) console.log(`[seed] created ${s.username} — one-time password: ${pw}`);
      const id = await createUser(
        s.username, pw, s.fullName, null,
        s.role, s.tenantId, s.position, s.faculty, s.titles, s.orcid
      );
      if (s.tenantAdmin) await sql`UPDATE users SET tenant_admin = TRUE WHERE id = ${id}`;
    } else {
      if (s.orcid && existing.orcid !== s.orcid) {
        await sql`UPDATE users SET orcid = ${s.orcid} WHERE id = ${existing.id}`;
      }
      if (s.tenantAdmin && existing.tenant_admin !== true) {
        await sql`UPDATE users SET tenant_admin = TRUE WHERE id = ${existing.id}`;
      }
      if (s.syncRole && existing.role !== s.role) {
        await sql`UPDATE users SET role = ${s.role} WHERE id = ${existing.id}`;
      }
    }
  }

  // One-time backfill: rewrite any legacy plaintext password as a hash.
  // Idempotent (the WHERE excludes already-hashed rows) and cheap after
  // the first run.
  const legacy = await sql`SELECT id, password FROM users WHERE password NOT LIKE 'scrypt$%'`;
  for (const row of legacy.rows) {
    await sql`UPDATE users SET password = ${await hashPassword(row.password)} WHERE id = ${row.id}`;
  }
  if (legacy.rows.length) console.log(`[seed] hashed ${legacy.rows.length} legacy password(s)`);
}

module.exports = { seedUsers };

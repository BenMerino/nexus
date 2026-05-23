const { sql } = require("./sql");
const { getUserByUsername, createUser } = require("./db-users");

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
    // existing row over (and reset its password) so there's a single
    // superadmin account, not two.
    ["superadmin", "superadmin@dev"],
  ];
  for (const [old, nu] of renames) {
    const existing = await getUserByUsername(old);
    if (existing) {
      await sql`UPDATE users SET username = ${nu} WHERE username = ${old}`;
    }
  }
  await sql`UPDATE users SET password = 'dev' WHERE username = 'superadmin@dev'`;

  const seeds = [
    {
      username: "superadmin@dev", password: "dev",
      fullName: "Super Admin", role: "superadmin", tenantId: null,
      position: "Platform Administrator", faculty: null, titles: null,
    },
    {
      username: "hectorquinteros@utalca.cl", password: "hectorben2026",
      fullName: "Héctor Quinteros Lama", role: "academic", tenantId: 1,
      position: "Director de Investigación", faculty: "Facultad de Tecnologías Industriales",
      titles: JSON.stringify(["Dr.", "Prof."]),
      orcid: "0000-0001-8953-6140", tenantAdmin: true, syncRole: true,
    },
    {
      username: "secretaria@utalca.cl", password: "secutalca2026",
      fullName: "Secretaría UTalca", role: "secretary", tenantId: 1,
      position: "Secretaria Académica", faculty: "Facultad de Ingeniería",
      titles: null,
    },
  ];

  for (const s of seeds) {
    const existing = await getUserByUsername(s.username);
    if (!existing) {
      const id = await createUser(
        s.username, s.password, s.fullName, null,
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
}

module.exports = { seedUsers };

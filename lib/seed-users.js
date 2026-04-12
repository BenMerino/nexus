const { sql } = require("@vercel/postgres");
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
  ];
  for (const [old, nu] of renames) {
    const existing = await getUserByUsername(old);
    if (existing) {
      await sql`UPDATE users SET username = ${nu} WHERE username = ${old}`;
    }
  }

  const seeds = [
    {
      username: "superadmin", password: "nexus2026super",
      fullName: "Super Admin", role: "superadmin", tenantId: null,
      position: "Platform Administrator", faculty: null, titles: null,
    },
    {
      username: "hectorquinteros@utalca.cl", password: "hectorben2026",
      fullName: "Héctor Quinteros Lama", role: "director", tenantId: 1,
      position: "Vicerrector", faculty: "Facultad de Ingeniería",
      titles: JSON.stringify(["Dr.", "Prof."]),
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
      await createUser(
        s.username, s.password, s.fullName, null,
        s.role, s.tenantId, s.position, s.faculty, s.titles
      );
    }
  }
}

module.exports = { seedUsers };

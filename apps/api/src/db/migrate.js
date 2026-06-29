// Tiny SQL migration runner. Mirrors Zincro's apps/api/src/db/migrate.ts.
// Reads .sql files from src/db/migrations/ in filename order, applies new
// ones inside a single transaction each, tracks applied migrations in
// `_migrations`. Idempotent: re-running is a no-op once everything is
// current.
//
// Two entry points:
//   CLI:   DATABASE_URL=... node apps/api/src/db/migrate.js
//   Boot:  const { runMigrations } = require("./db/migrate"); await runMigrations();

const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const MIGRATIONS_DIR = path.join(__dirname, "migrations");

async function runMigrations() {
  // Boot uses MIGRATION_DATABASE_URL (privileged role with DDL) when set,
  // falling back to POSTGRES_URL / DATABASE_URL for single-role environments.
  // The runtime pool in db/index.js always reads POSTGRES_URL/DATABASE_URL,
  // so a future split can swap the runtime to a limited role without
  // breaking migrations.
  const url =
    process.env.MIGRATION_DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL;
  if (!url) throw new Error("MIGRATION_DATABASE_URL / DATABASE_URL not set");

  const noSsl = /\.railway\.internal(:|$|\/)|@(localhost|127\.0\.0\.1)(:|$|\/)/.test(url);
  const cleaned = url
    .replace(/[?&](sslmode|channel_binding)=[^&]+/g, "")
    .replace(/[?&]$/, "")
    .replace(/\?&/, "?");
  const cfg = { connectionString: cleaned };
  if (!noSsl) cfg.ssl = { rejectUnauthorized: false };

  const client = new Client(cfg);
  await client.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        name        TEXT PRIMARY KEY,
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    const appliedRows = await client.query("SELECT name FROM _migrations");
    const applied = new Set(appliedRows.rows.map((r) => r.name));

    if (!fs.existsSync(MIGRATIONS_DIR)) {
      console.log(`[migrate] no migrations dir at ${MIGRATIONS_DIR}; skipping`);
      return { applied: 0, total: 0 };
    }
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    let count = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
      console.log(`[migrate] applying ${file}`);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO _migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
        count++;
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`[migrate] FAILED on ${file}:`, err.message);
        throw err;
      }
    }
    console.log(`[migrate] ${count}/${files.length} migrations applied (rest already up-to-date)`);
    return { applied: count, total: files.length };
  } finally {
    await client.end();
  }
}

// CLI entry
if (require.main === module) {
  runMigrations()
    .then((r) => {
      console.log("[migrate] done", r);
      process.exit(0);
    })
    .catch((err) => {
      console.error("[migrate] error:", err);
      process.exit(1);
    });
}

module.exports = { runMigrations };

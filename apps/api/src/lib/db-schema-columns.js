const { db } = require("./sql");

// Idempotent legacy column/index backfills layered onto the base tables.
// Each is `IF NOT EXISTS` and error-swallowed for "already exists", so this is
// a safe no-op on an up-to-date DB. New schema changes belong in numbered
// migrations (N2); this stays for the columns added during the pre-migration era.
async function addMissingColumns() {
  const safe = async (query) => {
    try { await db.query(query); } catch (err) {
      if (!err.message?.includes("already exists")) throw err;
    }
  };
  // doi_records is now a VIEW (migration 004 renamed the table to publications);
  // ALTER TABLE must target the real table. Idempotent — these columns already exist.
  await safe("ALTER TABLE publications ADD COLUMN IF NOT EXISTS tenant_id INTEGER DEFAULT 1");
  await safe("ALTER TABLE publications ADD COLUMN IF NOT EXISTS source_indices TEXT");
  await safe("ALTER TABLE submissions ADD COLUMN IF NOT EXISTS tenant_id INTEGER DEFAULT 1");
  await safe("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#333333'");
  await safe("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS secondary_color TEXT DEFAULT '#1565c0'");
  await safe("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES tenants(id)");
  await safe("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS slug TEXT");
  await safe("CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug)");
  await safe(`CREATE TABLE IF NOT EXISTS theme_tokens (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW())`);
  await safe("ALTER TABLE users ADD COLUMN IF NOT EXISTS grado_academico TEXT");
  await safe("ALTER TABLE users ADD COLUMN IF NOT EXISTS horas_permanencia INTEGER");
}

module.exports = { addMissingColumns };

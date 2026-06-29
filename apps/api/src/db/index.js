// Postgres connection pool + tenant-scoped transaction helpers.
//
// Mirrors Zincro's apps/api/src/db/index.ts. Replaces the @vercel/postgres
// `sql` template (kept around in src/lib/sql.js as a transitional shim for
// pre-existing call sites) with the standard pg API: callers use `pool.query`
// directly, transactional flows use `withTenant`.
//
// Connection rules (matches src/lib/sql.js):
//   - *.railway.internal → no SSL (Railway's private network is plain TCP).
//   - external hosts (Railway public proxy, Neon) → SSL with
//     rejectUnauthorized=false (their certs aren't in Node's default trust
//     store). Strip sslmode/channel_binding from the URL so pg doesn't
//     auto-derive an ssl config that overrides ours.

const { Pool } = require("pg");

const url =
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL_NON_POOLING;

function buildPoolConfig(connectionString) {
  const noSsl = /\.railway\.internal(:|$|\/)|@(localhost|127\.0\.0\.1)(:|$|\/)/.test(connectionString);
  const cleaned = connectionString
    .replace(/[?&](sslmode|channel_binding)=[^&]+/g, "")
    .replace(/[?&]$/, "")
    .replace(/\?&/, "?");
  const cfg = { connectionString: cleaned, max: 10 };
  if (!noSsl) cfg.ssl = { rejectUnauthorized: false };
  return cfg;
}

const pool = url ? new Pool(buildPoolConfig(url)) : null;

if (!pool) {
  console.warn("[db] No POSTGRES_URL / DATABASE_URL set; queries will fail.");
}

// Run `fn` inside a transaction with `app.tenant_id` set, so any RLS policy
// that relies on it scopes every query in the block to the current tenant.
// Even without RLS today, this gives us a single seam for tenant isolation
// going forward — the pattern Zincro relies on.
async function withTenant(tenantId, fn) {
  if (!pool) throw new Error("withTenant: pool unavailable (no DATABASE_URL)");
  if (tenantId == null) throw new Error("withTenant: tenantId required");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [String(tenantId)]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch {}
    throw err;
  } finally {
    client.release();
  }
}

// Cross-tenant query (no tenant scope). Used for the `users` table on
// login, tenant listings, and admin operations.
async function withoutTenant(fn) {
  if (!pool) throw new Error("withoutTenant: pool unavailable");
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

// Convenience for repo functions that may be called either standalone or
// from inside an outer withTenant. Mirrors Zincro's runOn helper exactly.
async function runOn(tenantId, tx, fn) {
  if (tx) {
    if (String(tx.tenantId) !== String(tenantId)) {
      throw new Error(`runOn: tenant mismatch (tx=${tx.tenantId}, requested=${tenantId})`);
    }
    return fn(tx.client);
  }
  return withTenant(tenantId, fn);
}

module.exports = { pool, withTenant, withoutTenant, runOn };

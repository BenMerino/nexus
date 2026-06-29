// Drop-in replacement for `@vercel/postgres`'s `sql` tagged template and `db`
// query helper, backed by a long-lived `pg.Pool`. Lets every existing
// `const { sql } = require("./sql")` keep working unchanged in the Railway
// runtime, where the Vercel/Neon HTTP transport isn't available.
//
// `sql` accepts the same template form: sql`SELECT * FROM t WHERE id = ${id}`
// and returns `{ rows, rowCount }`, matching the prior shape callers expect.
//
// `db.query(text, params?)` runs raw SQL — used by the schema bootstrap for
// DDL statements that template-literal interpolation would otherwise
// parameterize incorrectly.

const { Pool } = require("pg");

const connectionString =
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL_NON_POOLING;

if (!connectionString) {
  // Don't throw at import time — some scripts import this file just to read
  // exports. The first query will fail with a clear error.
  console.warn("[sql] No POSTGRES_URL / DATABASE_URL set; queries will fail.");
}

// Railway-internal hostnames (*.railway.internal) speak plain TCP — no TLS.
// External hostnames (Railway public proxy, Neon, etc.) require TLS, but
// the certificate chain isn't installed in stock Node images, so we accept
// self-signed. This matches @vercel/postgres' previous behavior on Vercel.
function buildPoolConfig(url) {
  const noSsl = /\.railway\.internal(:|$|\/)|@(localhost|127\.0\.0\.1)(:|$|\/)/.test(url);
  // Strip sslmode/channel_binding from the URL so pg doesn't auto-derive
  // its own ssl config that overrides ours. We set `ssl` explicitly:
  // - internal / localhost: no SSL (Railway's private network and local
  //   Postgres both speak plain TCP).
  // - external: SSL with rejectUnauthorized=false (Railway/Neon use certs
  //   not in Node's default trust store; matches @vercel/postgres behavior).
  const cleaned = url.replace(/[?&](sslmode|channel_binding)=[^&]+/g, "")
                     .replace(/[?&]$/, "")
                     .replace(/\?&/, "?");
  const cfg = { connectionString: cleaned, max: 10 };
  if (!noSsl) cfg.ssl = { rejectUnauthorized: false };
  return cfg;
}

const pool = connectionString
  ? new Pool(buildPoolConfig(connectionString))
  : null;

function buildParameterized(strings, values) {
  let text = "";
  const params = [];
  for (let i = 0; i < strings.length; i++) {
    text += strings[i];
    if (i < values.length) {
      params.push(values[i]);
      text += `$${params.length}`;
    }
  }
  return { text, params };
}

async function sql(strings, ...values) {
  if (!pool) throw new Error("sql: no DATABASE_URL configured");
  const { text, params } = buildParameterized(strings, values);
  const r = await pool.query(text, params);
  return { rows: r.rows, rowCount: r.rowCount, command: r.command, fields: r.fields };
}

// `sql.query(text, params?)` — `@vercel/postgres` exposes this on the same
// object as the tagged template. Used for queries built dynamically (e.g.
// SQL with variable IN-list expansion) where template literals don't fit.
sql.query = async function (text, params) {
  if (!pool) throw new Error("sql.query: no DATABASE_URL configured");
  const r = await pool.query(text, params);
  return { rows: r.rows, rowCount: r.rowCount, command: r.command, fields: r.fields };
};

const db = {
  async query(text, params) {
    if (!pool) throw new Error("db.query: no DATABASE_URL configured");
    return pool.query(text, params);
  },
};

module.exports = { sql, db, pool };

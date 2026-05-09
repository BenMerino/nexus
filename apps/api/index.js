// Express entry point for Nexus API on Railway. Replaces the Vercel runtime
// while keeping every handler in `handlers/` working unchanged: each Vercel-
// shaped `(req, res) => ...` file is auto-mounted at `/api/<name>`, with
// `[param].js` translated to Express `:param` routes (e.g. records/[id].js
// → /api/records/:id). Listens on PORT (Railway sets this) and binds 0.0.0.0.

const express = require("express");
const path = require("path");
const fs = require("fs");
const { pool } = require("./src/db");
const { runMigrations } = require("./src/db/migrate");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HANDLERS_DIR = path.join(__dirname, "handlers");

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Health check used by Railway. Reports DB reachability + pool stats so
// failed deploys don't replace healthy ones; returns 503 when the pool
// can't reach Postgres. Verbose form (?verbose=1) includes pool depth.
const startedAt = Date.now();
app.get("/healthz", async (req, res) => {
  const t0 = Date.now();
  const verbose = req.query.verbose === "1";
  const snap = {
    api: { ok: true, uptime_s: Math.floor((Date.now() - startedAt) / 1000) },
    db: { ok: false, latency_ms: -1 },
    check_ms: 0,
  };
  if (!pool) {
    snap.db.error = "DATABASE_URL not set";
  } else {
    try {
      const t = Date.now();
      await pool.query("SELECT 1");
      snap.db.latency_ms = Date.now() - t;
      snap.db.ok = true;
    } catch (err) {
      snap.db.error = err.message;
    }
    if (verbose) {
      snap.db.pool = {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount,
      };
    }
  }
  snap.check_ms = Date.now() - t0;
  res.status(snap.db.ok ? 200 : 503).json(snap);
});

const { mountHandlers } = require("./src/lib/handler-mount");
mountHandlers(app, HANDLERS_DIR, __dirname);

const { registerAliases } = require("./src/lib/route-aliases");
registerAliases(app);

// 404 for unmatched /api/* — keeps SPA fallback in Caddy from masking
// genuine API typos with HTML responses.
app.use("/api", (req, res) => {
  res.status(404).json({ error: "Not found", path: req.originalUrl });
});

// Centralized error handler. Logs full stack, returns minimal JSON.
app.use((err, req, res, next) => {
  console.error(`[error] ${req.method} ${req.originalUrl}:`, err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: err.message || "Internal Server Error" });
});

// Apply pending DB migrations before serving any traffic. Hard fail on
// error: a half-migrated DB is worse than a refusing-to-start API,
// because Postgres errors only surface when the relevant route is hit.
async function startServer() {
  if (process.env.POSTGRES_URL || process.env.DATABASE_URL) {
    try {
      await runMigrations();
    } catch (err) {
      console.error("[boot] migration failed, refusing to start:", err);
      process.exit(1);
    }
  } else {
    console.warn("[boot] no DATABASE_URL — skipping migrations");
  }
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[boot] Nexus API listening on :${PORT}`);
  });
  attachShutdown(server);
}
startServer();

// Graceful shutdown: Railway sends SIGTERM with up to
// RAILWAY_DEPLOYMENT_DRAINING_SECONDS (60s) before SIGKILL. Stop accepting
// new connections, drain in-flight requests, close pg pool, then exit.
function attachShutdown(server) {
  function shutdown(signal) {
    console.log(`[shutdown] received ${signal}, draining…`);
    server.close(async () => {
      try { if (pool) await pool.end(); } catch {}
      console.log("[shutdown] done");
      process.exit(0);
    });
    setTimeout(() => {
      console.error("[shutdown] forced exit after 30s");
      process.exit(1);
    }, 30_000).unref();
  }
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

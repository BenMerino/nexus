// Express entry point for Nexus API on Railway. Replaces the Vercel runtime
// while keeping every handler in `handlers/` working unchanged: each Vercel-
// shaped `(req, res) => ...` file is auto-mounted at `/api/<name>`, with
// `[param].js` translated to Express `:param` routes (e.g. records/[id].js
// → /api/records/:id). Listens on PORT (Railway sets this) and binds 0.0.0.0.

const express = require("express");
const path = require("path");
const fs = require("fs");
const { pool } = require("./src/lib/sql");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HANDLERS_DIR = path.join(__dirname, "handlers");

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Health check used by Railway. Reports DB reachability so failed deploys
// don't replace healthy ones; returns 503 when the pool can't reach Postgres.
app.get("/healthz", async (req, res) => {
  const out = { api: "ok", db: "unknown", uptime_s: Math.floor(process.uptime()) };
  if (!pool) { out.db = "no-url"; return res.status(503).json(out); }
  try {
    const t = Date.now();
    await pool.query("SELECT 1");
    out.db = "ok";
    out.db_latency_ms = Date.now() - t;
    return res.status(200).json(out);
  } catch (err) {
    out.db = "fail";
    out.error = err.message;
    return res.status(503).json(out);
  }
});

// Translate Vercel's [param] segment syntax to Express' :param. Used both
// for filename basenames and intermediate directory names.
function vercelToExpress(seg) {
  return seg.replace(/^\[(.+)\]$/, ":$1");
}

// Vercel handlers expect req.query to be a parsed object — Express puts it
// there already, but Vercel handlers also rely on dynamic params (e.g.
// records/[id].js reads req.query.id). We merge req.params into req.query
// so the same handler code works in both runtimes.
function makeAdapter(handler) {
  return async (req, res, next) => {
    try {
      // Express already parses req.query for ?key=val. Merge route params.
      req.query = { ...req.query, ...req.params };
      // Some handlers (e.g. claustro.js) inspect req.url with the leading
      // /api/ stripped to dispatch internally. Express has req.path; leave.
      const result = handler(req, res);
      if (result && typeof result.then === "function") await result;
    } catch (err) {
      next(err);
    }
  };
}

function mountDir(dir, urlPrefix) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      mountDir(full, `${urlPrefix}/${vercelToExpress(entry.name)}`);
      continue;
    }
    if (!entry.name.endsWith(".js")) continue;
    const base = entry.name.slice(0, -3);
    const routeSeg = vercelToExpress(base);
    const routePath = `${urlPrefix}/${routeSeg}`;
    let mod;
    try {
      mod = require(full);
    } catch (err) {
      console.error(`[mount] failed to load ${full}:`, err.message);
      continue;
    }
    const handler = typeof mod === "function" ? mod : (mod && mod.default) || (mod && mod.handler);
    if (typeof handler !== "function") {
      console.warn(`[mount] ${full} has no default export; skipping`);
      continue;
    }
    // Mount on all common verbs — handlers gate on req.method internally.
    app.all(routePath, makeAdapter(handler));
    console.log(`[mount] ${routePath} → ${path.relative(__dirname, full)}`);
  }
}

mountDir(HANDLERS_DIR, "/api");

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

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`[boot] Nexus API listening on :${PORT}`);
});

// Graceful shutdown: Railway sends SIGTERM with up to
// RAILWAY_DEPLOYMENT_DRAINING_SECONDS (60s) before SIGKILL. Stop accepting
// new connections, drain in-flight requests, close pg pool, then exit.
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

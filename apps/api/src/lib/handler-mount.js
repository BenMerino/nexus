// Auto-mounts every Vercel-shape `(req, res) => ...` file in handlers/
// at /api/<filename without .js>, with [param].js translated to Express
// :param routes (e.g. records/[id].js → /api/records/:id). Lets the
// existing handlers keep working unchanged after the move off Vercel.

const fs = require("fs");
const path = require("path");

// Translate Vercel's [param] segment syntax to Express' :param. Used both
// for filename basenames and intermediate directory names.
function vercelToExpress(seg) {
  return seg.replace(/^\[(.+)\]$/, ":$1");
}

// Vercel handlers rely on req.query for both ?key=val and dynamic
// segments. Express puts ?key=val in req.query already; we merge
// req.params on top so records/[id].js can keep reading req.query.id.
function makeAdapter(handler) {
  return async (req, res, next) => {
    try {
      req.query = { ...req.query, ...req.params };
      const result = handler(req, res);
      if (result && typeof result.then === "function") await result;
    } catch (err) {
      next(err);
    }
  };
}

function mountDir(app, dir, urlPrefix, baseDir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      mountDir(app, full, `${urlPrefix}/${vercelToExpress(entry.name)}`, baseDir);
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
    console.log(`[mount] ${routePath} → ${path.relative(baseDir, full)}`);
  }
}

function mountHandlers(app, handlersDir, baseDir) {
  mountDir(app, handlersDir, "/api", baseDir || handlersDir);
}

module.exports = { mountHandlers };

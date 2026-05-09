// REST-style aliases for handlers that dispatch via ?action=...
// Mirrors Zincro's path-segment convention (/api/auth/login vs
// /api/auth?action=login). Internally, we rewrite req.query.action and
// forward to the existing handler — no code duplication, additive only,
// the original query-string form keeps working until SPA callers migrate.

const path = require("path");

function aliasAction(app, handlerPath, actions) {
  const handler = require(handlerPath);
  for (const action of actions) {
    app.all(`/api/${action.path}`, async (req, res, next) => {
      try {
        req.query = { ...req.query, action: action.name, ...req.params };
        await handler(req, res);
      } catch (err) {
        next(err);
      }
    });
    console.log(`[alias] /api/${action.path} → ${path.basename(handlerPath)}?action=${action.name}`);
  }
}

function registerAliases(app) {
  aliasAction(app, "../../handlers/auth.js", [
    { path: "auth/login", name: "login" },
    { path: "auth/logout", name: "logout" },
    { path: "auth/me", name: "me" },
    { path: "auth/users", name: "users" },
    { path: "auth/tenants", name: "tenants" },
  ]);
  aliasAction(app, "../../handlers/dashboard.js", [
    { path: "dashboard/stats", name: "stats" },
    { path: "dashboard/series", name: "series" },
  ]);
  aliasAction(app, "../../handlers/files.js", [
    { path: "files/presign", name: "presign" },
  ]);
}

module.exports = { registerAliases };

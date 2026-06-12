const { ensureSchema } = require("../src/lib/db");
const { getTenantBySlug } = require("../src/lib/db-users");
const { buildMetaFragment } = require("../src/lib/public-meta");

// GET /api/public-meta?uri=/t/:slug[/a/:orcid]
// HTML <meta> fragment for the public pages, injected server-side by Caddy's
// `templates` pass (httpInclude) so social/link previews carry the tenant's
// real name and logo. MUST always answer 200 with text/html — a non-2xx here
// would fail the whole page's template render.
module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300, stale-while-revalidate=3600");
  try {
    await ensureSchema();
    const m = String(req.query.uri || "").match(/^\/t\/([^/?#]+)(?:\/a\/([^/?#]+))?/);
    if (!m) return res.send("");
    const tenant = await getTenantBySlug(decodeURIComponent(m[1]));
    if (!tenant) return res.send("");
    res.send(await buildMetaFragment(tenant, m[2] ? decodeURIComponent(m[2]) : null));
  } catch (err) {
    console.error("[public-meta]", err);
    res.send(""); // fail-soft: the page renders with its static head
  }
};

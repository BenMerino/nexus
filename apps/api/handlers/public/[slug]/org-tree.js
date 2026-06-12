const { ensureSchema } = require("../../../src/lib/db");
const { getTenantBySlug } = require("../../../src/lib/db-users");
const { queryOrgTree } = require("../../../src/lib/org-tree");

// GET /api/public/:slug/org-tree
// Public-read view of the tenant's organisation scheme (Faculty -> Department
// -> people). Same data the admin /api/auth?action=org-tree returns, scoped
// by URL slug so unauthenticated visitors can see it on the public profile.
// Privacy parity: the same names + ORCIDs are already exposed via the public
// authors directory; this just shows them in their org-chart position.
module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  await ensureSchema();
  const tenant = await getTenantBySlug(req.query.slug);
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });

  try {
    const tree = await queryOrgTree(tenant.id);
    // ?summary=1 strips per-person rows — the public page's consumers (scope
    // rail, contributors ranking) read only unit aggregates, and `people` is
    // most of the payload. Default (full) shape unchanged for other callers.
    const body = req.query.summary
      ? { ...tree, faculties: tree.faculties.map((f) => ({ ...f, departments: f.departments.map(({ people, ...d }) => d) })) }
      : tree;
    // max-age: Railway has no shared cache (s-maxage alone does nothing), so
    // let the BROWSER reuse this briefly — back-navigation stops refetching.
    res.setHeader("Cache-Control", "public, max-age=120, s-maxage=300, stale-while-revalidate=3600");
    res.json(body);
  } catch (err) {
    console.error("[public/org-tree]", err);
    res.status(500).json({ error: err.message });
  }
};

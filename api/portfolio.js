const { sql } = require("@vercel/postgres");
const { ensureSchema } = require("../lib/db");
const { requireScope, isPersonalScope } = require("../lib/scope");
const { getResearcherPortfolio } = require("../lib/portfolio");

async function lookupResearcher(orcid, tenantId) {
  const u = await sql`SELECT full_name, faculty FROM users WHERE orcid = ${orcid} AND tenant_id = ${tenantId} LIMIT 1`;
  if (u.rows[0]) return { name: u.rows[0].full_name, faculty: u.rows[0].faculty };
  const t = await sql`SELECT value FROM tags WHERE category = 'author' AND ext_id = ${orcid} LIMIT 1`;
  return { name: t.rows[0]?.value || null, faculty: null };
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  await ensureSchema();
  const scope = await requireScope(req, res);
  if (!scope) return;

  const requestedOrcid = req.query.orcid;
  let orcid = scope.orcid;
  if (requestedOrcid && requestedOrcid !== scope.orcid) {
    if (isPersonalScope(scope)) {
      return res.status(403).json({ error: "Personal scope cannot view other researchers" });
    }
    orcid = requestedOrcid;
  }
  if (!orcid) return res.status(400).json({ error: "ORCID required (set on user or pass ?orcid=)" });

  try {
    const [meta, portfolio] = await Promise.all([
      lookupResearcher(orcid, scope.tenantId),
      getResearcherPortfolio(orcid, scope.tenantId),
    ]);
    res.json({
      researcher: { orcid, name: meta.name, faculty: meta.faculty, ror: scope.ror, tenantId: scope.tenantId },
      ...portfolio,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

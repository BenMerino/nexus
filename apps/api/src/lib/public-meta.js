const { sql } = require("./sql");
const { normOrcid } = require("./entity-normalize");

// Composes the <meta> fragment Caddy injects into the public pages' <head>
// (see handlers/public-meta.js). Output is attribute-escaped HTML; og:title
// names the tenant (or the academic, on profile pages) so shared links
// preview meaningfully instead of as the generic SPA shell.

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function tag(prop, content) {
  return content ? `<meta property="${prop}" content="${esc(content)}">` : "";
}

async function authorName(tenantId, rawOrcid) {
  const orcid = normOrcid(rawOrcid);
  if (!orcid) return null;
  const r = await sql`
    SELECT name FROM authors WHERE tenant_id = ${tenantId} AND orcid = ${orcid} LIMIT 1`;
  return (r.rows[0] && r.rows[0].name) || null;
}

async function buildMetaFragment(tenant, orcid) {
  const name = orcid ? await authorName(tenant.id, orcid) : null;
  const title = name ? `${name} — ${tenant.name}` : `${tenant.name} — Research`;
  const description = name
    ? `Public academic profile of ${name} at ${tenant.name}: publications, citations and h-index.`
    : `Public research profile of ${tenant.name}: publications, citations, open access and collaboration analytics.`;
  return [
    tag("og:title", title),
    tag("og:description", description),
    tag("og:type", "website"),
    tag("og:site_name", tenant.name),
    tag("og:image", tenant.logo_url),
    `<meta name="twitter:card" content="summary">`,
    `<meta name="description" content="${esc(description)}">`,
  ].filter(Boolean).join("\n  ");
}

module.exports = { buildMetaFragment };

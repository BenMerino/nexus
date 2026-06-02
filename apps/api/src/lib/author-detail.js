const { sql } = require("./sql");
const { normOrcid } = require("./entity-normalize");
const { entityPapersAll, entityCitationCounts, entityLabel } = require("./entity-detail");

// Author by ORCID (no name-only authors exist). Stats over the full population
// (h-index needs every paper); the list is uncapped (the view groups by journal).
async function authorCitationStats(scope, ext_id) {
  const counts = await entityCitationCounts(scope, "author", ext_id);
  let hIndex = 0;
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] >= i + 1) hIndex = i + 1; else break;
  }
  return { papersCount: counts.length, citations: counts.reduce((s, c) => s + c, 0), hIndex };
}

async function authorDetail(scope, ext_id, label) {
  const [papers, stats] = await Promise.all([
    entityPapersAll(scope, "author", ext_id),
    authorCitationStats(scope, ext_id),
  ]);
  let u = null;
  if (ext_id) {
    const r = await sql`SELECT full_name, faculty, position FROM users WHERE orcid = ${normOrcid(ext_id)} AND tenant_id = ${scope.tenantId} LIMIT 1`;
    u = r.rows[0] || null;
  }
  // External authors aren't in `users`; pull their canonical name from the
  // author entity. When the label is itself the ORCID, emit "Unknown author".
  const entName = u?.full_name ? null : await entityLabel("author", ext_id, scope.tenantId);
  const labelLooksLikeOrcid = label && /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(label);
  const name = u?.full_name || entName || (labelLooksLikeOrcid ? "Unknown author" : label);
  const journalsCount = new Set(papers.map(p => p.journal).filter(Boolean)).size;
  return { type: "author", name, orcid: ext_id, faculty: u?.faculty, role: u?.position, papersCount: stats.papersCount, citations: stats.citations, hIndex: stats.hIndex, journalsCount, papers };
}

module.exports = { authorDetail };

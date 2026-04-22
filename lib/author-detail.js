const { sql } = require("@vercel/postgres");
const { isPersonalScope } = require("./scope");
const { extIdVariants, tagLabel } = require("./node-detail-helpers");

async function authorCitationStats(scope, ext_id, value) {
  // Pull every paper's citation count for accurate totals and h-index — the
  // UI list can be capped, but stats must see the full population.
  const personal = isPersonalScope(scope);
  const rows = ext_id
    ? (personal
        ? await sql`SELECT d.citation_count FROM doi_records d
            WHERE d.id IN (SELECT doi_record_id FROM tags WHERE category='author' AND ext_id = ANY(${extIdVariants("author", ext_id)}))
              AND d.id IN (SELECT doi_record_id FROM tags WHERE category='author' AND ext_id=${scope.orcid})`
        : await sql`SELECT d.citation_count FROM doi_records d
            WHERE d.id IN (SELECT doi_record_id FROM tags WHERE category='author' AND ext_id = ANY(${extIdVariants("author", ext_id)}))
              AND d.tenant_id = ${scope.tenantId}`)
    : (personal
        ? await sql`SELECT d.citation_count FROM doi_records d
            WHERE d.id IN (SELECT doi_record_id FROM tags WHERE category='author' AND value=${value})
              AND d.id IN (SELECT doi_record_id FROM tags WHERE category='author' AND ext_id=${scope.orcid})`
        : await sql`SELECT d.citation_count FROM doi_records d
            WHERE d.id IN (SELECT doi_record_id FROM tags WHERE category='author' AND value=${value})
              AND d.tenant_id = ${scope.tenantId}`);
  const counts = rows.rows.map(r => r.citation_count || 0).sort((a, b) => b - a);
  let hIndex = 0;
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] >= i + 1) hIndex = i + 1; else break;
  }
  return { papersCount: counts.length, citations: counts.reduce((s, c) => s + c, 0), hIndex };
}

async function authorPapersAll(scope, ext_id, value) {
  // Uncapped paper list — the author detail view groups these by journal and
  // renders every paper, so the 12-row cap used elsewhere doesn't apply.
  const personal = isPersonalScope(scope);
  if (ext_id) {
    const variants = extIdVariants("author", ext_id);
    return personal
      ? await sql`SELECT d.doi, d.title, d.published, d.citation_count, d.journal
          FROM doi_records d
          WHERE d.id IN (SELECT doi_record_id FROM tags WHERE category='author' AND ext_id = ANY(${variants}))
            AND d.id IN (SELECT doi_record_id FROM tags WHERE category='author' AND ext_id=${scope.orcid})
          ORDER BY d.published DESC NULLS LAST`
      : await sql`SELECT d.doi, d.title, d.published, d.citation_count, d.journal
          FROM doi_records d
          WHERE d.id IN (SELECT doi_record_id FROM tags WHERE category='author' AND ext_id = ANY(${variants}))
            AND d.tenant_id = ${scope.tenantId}
          ORDER BY d.published DESC NULLS LAST`;
  }
  return personal
    ? await sql`SELECT d.doi, d.title, d.published, d.citation_count, d.journal
        FROM doi_records d
        WHERE d.id IN (SELECT doi_record_id FROM tags WHERE category='author' AND value=${value})
          AND d.id IN (SELECT doi_record_id FROM tags WHERE category='author' AND ext_id=${scope.orcid})
        ORDER BY d.published DESC NULLS LAST`
    : await sql`SELECT d.doi, d.title, d.published, d.citation_count, d.journal
        FROM doi_records d
        WHERE d.id IN (SELECT doi_record_id FROM tags WHERE category='author' AND value=${value})
          AND d.tenant_id = ${scope.tenantId}
        ORDER BY d.published DESC NULLS LAST`;
}

async function authorDetail(scope, ext_id, label) {
  const [{ rows: papers }, stats] = await Promise.all([
    authorPapersAll(scope, ext_id, label),
    authorCitationStats(scope, ext_id, label),
  ]);
  let u = null;
  if (ext_id) {
    const r = await sql`SELECT full_name, faculty, position FROM users WHERE orcid = ${ext_id} AND tenant_id = ${scope.tenantId} LIMIT 1`;
    u = r.rows[0] || null;
  }
  // External authors aren't in `users`; pull their name from the author tag
  // (ingestion stores human names under `value`). When the label is itself
  // the ORCID, emit "Unknown author" so the ORCID doesn't appear twice.
  const tagName = u?.full_name ? null : await tagLabel("author", ext_id);
  const labelLooksLikeOrcid = label && /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(label);
  const name = u?.full_name || tagName || (labelLooksLikeOrcid ? "Unknown author" : label);
  const journalsCount = new Set(papers.map(p => p.journal).filter(Boolean)).size;
  return { type: "author", name, orcid: ext_id, faculty: u?.faculty, role: u?.position, papersCount: stats.papersCount, citations: stats.citations, hIndex: stats.hIndex, journalsCount, papers };
}

module.exports = { authorDetail };

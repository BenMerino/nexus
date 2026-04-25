const { sql } = require("@vercel/postgres");
const { isPersonalScope } = require("./scope");
const { extIdVariants, tagLabel } = require("./node-detail-helpers");

async function institutionCitationStats(scope, ext_id, value) {
  // Full-population citation totals for a university-scale set of papers.
  const personal = isPersonalScope(scope);
  const rows = ext_id
    ? (personal
        ? await sql`SELECT d.citation_count FROM doi_records d
            WHERE d.id IN (SELECT doi_record_id FROM tags WHERE category='institution' AND ext_id = ANY(${extIdVariants("institution", ext_id)}))
              AND d.id IN (SELECT doi_record_id FROM tags WHERE category='author' AND ext_id=${scope.orcid})`
        : await sql`SELECT d.citation_count FROM doi_records d
            WHERE d.id IN (SELECT doi_record_id FROM tags WHERE category='institution' AND ext_id = ANY(${extIdVariants("institution", ext_id)}))
              AND d.tenant_id = ${scope.tenantId}`)
    : (personal
        ? await sql`SELECT d.citation_count FROM doi_records d
            WHERE d.id IN (SELECT doi_record_id FROM tags WHERE category='institution' AND value=${value})
              AND d.id IN (SELECT doi_record_id FROM tags WHERE category='author' AND ext_id=${scope.orcid})`
        : await sql`SELECT d.citation_count FROM doi_records d
            WHERE d.id IN (SELECT doi_record_id FROM tags WHERE category='institution' AND value=${value})
              AND d.tenant_id = ${scope.tenantId}`);
  return { papersCount: rows.rows.length, citations: rows.rows.reduce((s, r) => s + (r.citation_count || 0), 0) };
}

async function institutionPapersAll(scope, ext_id, value) {
  const personal = isPersonalScope(scope);
  if (ext_id) {
    const variants = extIdVariants("institution", ext_id);
    return personal
      ? await sql`SELECT d.doi, d.title, d.published, d.citation_count, d.journal
          FROM doi_records d
          WHERE d.id IN (SELECT doi_record_id FROM tags WHERE category='institution' AND ext_id = ANY(${variants}))
            AND d.id IN (SELECT doi_record_id FROM tags WHERE category='author' AND ext_id=${scope.orcid})
          ORDER BY d.published DESC NULLS LAST`
      : await sql`SELECT d.doi, d.title, d.published, d.citation_count, d.journal
          FROM doi_records d
          WHERE d.id IN (SELECT doi_record_id FROM tags WHERE category='institution' AND ext_id = ANY(${variants}))
            AND d.tenant_id = ${scope.tenantId}
          ORDER BY d.published DESC NULLS LAST`;
  }
  return personal
    ? await sql`SELECT d.doi, d.title, d.published, d.citation_count, d.journal
        FROM doi_records d
        WHERE d.id IN (SELECT doi_record_id FROM tags WHERE category='institution' AND value=${value})
          AND d.id IN (SELECT doi_record_id FROM tags WHERE category='author' AND ext_id=${scope.orcid})
        ORDER BY d.published DESC NULLS LAST`
    : await sql`SELECT d.doi, d.title, d.published, d.citation_count, d.journal
        FROM doi_records d
        WHERE d.id IN (SELECT doi_record_id FROM tags WHERE category='institution' AND value=${value})
          AND d.tenant_id = ${scope.tenantId}
        ORDER BY d.published DESC NULLS LAST`;
}

async function institutionDetail(scope, ext_id, label) {
  const [{ rows: papers }, stats] = await Promise.all([
    institutionPapersAll(scope, ext_id, label),
    institutionCitationStats(scope, ext_id, label),
  ]);
  const name = (await tagLabel("institution", ext_id)) || label;
  const journalsCount = new Set(papers.map(p => p.journal).filter(Boolean)).size;
  return { type: "institution", name, ror: ext_id, papersCount: stats.papersCount, citations: stats.citations, journalsCount, papers };
}

module.exports = { institutionDetail };

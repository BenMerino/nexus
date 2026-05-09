const { sql } = require("./sql");
const { isPersonalScope } = require("./scope");

function extIdVariants(category, ext_id) {
  const v = [ext_id];
  if (category === "institution" && !/^https?:/.test(ext_id)) v.push(`https://ror.org/${ext_id}`);
  if (category === "author" && !/^https?:/.test(ext_id)) v.push(`https://orcid.org/${ext_id}`);
  return v;
}

async function papersByTag(scope, category, ext_id, value) {
  const personal = isPersonalScope(scope);
  if (ext_id) {
    const variants = extIdVariants(category, ext_id);
    return personal
      ? await sql`
          SELECT d.doi, d.title, d.published, d.citation_count, d.journal
          FROM doi_records d
          WHERE d.id IN (SELECT doi_record_id FROM tags WHERE category=${category} AND ext_id = ANY(${variants}))
            AND d.id IN (SELECT doi_record_id FROM tags WHERE category='author' AND ext_id=${scope.orcid})
          ORDER BY d.published DESC NULLS LAST LIMIT 12`
      : await sql`
          SELECT d.doi, d.title, d.published, d.citation_count, d.journal
          FROM doi_records d
          WHERE d.id IN (SELECT doi_record_id FROM tags WHERE category=${category} AND ext_id = ANY(${variants}))
            AND d.tenant_id = ${scope.tenantId}
          ORDER BY d.published DESC NULLS LAST LIMIT 12`;
  }
  return personal
    ? await sql`
        SELECT d.doi, d.title, d.published, d.citation_count, d.journal
        FROM doi_records d
        WHERE d.id IN (SELECT doi_record_id FROM tags WHERE category=${category} AND value=${value})
          AND d.id IN (SELECT doi_record_id FROM tags WHERE category='author' AND ext_id=${scope.orcid})
        ORDER BY d.published DESC NULLS LAST LIMIT 12`
    : await sql`
        SELECT d.doi, d.title, d.published, d.citation_count, d.journal
        FROM doi_records d
        WHERE d.id IN (SELECT doi_record_id FROM tags WHERE category=${category} AND value=${value})
          AND d.tenant_id = ${scope.tenantId}
        ORDER BY d.published DESC NULLS LAST LIMIT 12`;
}

async function tagLabel(category, ext_id) {
  if (!ext_id) return null;
  const variants = extIdVariants(category, ext_id);
  const r = await sql`
    SELECT value FROM tags
    WHERE category = ${category} AND ext_id = ANY(${variants})
      AND value IS NOT NULL AND value <> ''
    ORDER BY LENGTH(value) DESC LIMIT 1`;
  return r.rows[0]?.value || null;
}

module.exports = { extIdVariants, papersByTag, tagLabel };

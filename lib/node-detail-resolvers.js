const { sql } = require("@vercel/postgres");
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

async function authorCitationStats(scope, ext_id, value) {
  // Pull every paper's citation count for accurate totals and h-index. The
  // per-view `papers` list is capped at 12 for rendering; stats need the full
  // population.
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

async function authorDetail(scope, ext_id, label) {
  const [{ rows: papers }, stats] = await Promise.all([
    papersByTag(scope, "author", ext_id, label),
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
  return { type: "author", name, orcid: ext_id, faculty: u?.faculty, role: u?.position, papersCount: stats.papersCount, citations: stats.citations, hIndex: stats.hIndex, papers };
}

async function institutionDetail(scope, ext_id, label) {
  const { rows: papers } = await papersByTag(scope, "institution", ext_id, label);
  const name = (await tagLabel("institution", ext_id)) || label;
  return { type: "institution", name, ror: ext_id, papersCount: papers.length, papers };
}

async function journalDetail(scope, ext_id, label) {
  const name = (await tagLabel("journal", ext_id)) || label;
  // Query by name so ISSN siblings (print + online) all resolve to the same
  // journal — a single canonical node must return all its papers.
  const { rows: papers } = await papersByTag(scope, "journal", null, name);
  return { type: "journal", name, issn: ext_id, papersCount: papers.length, papers };
}

async function paperDetail(scope, doi) {
  const personal = isPersonalScope(scope);
  const r = personal
    ? await sql`SELECT doi, title, published, citation_count, journal, authors FROM doi_records
        WHERE doi=${doi} AND id IN (SELECT doi_record_id FROM tags WHERE category='author' AND ext_id=${scope.orcid}) LIMIT 1`
    : await sql`SELECT doi, title, published, citation_count, journal, authors FROM doi_records
        WHERE doi=${doi} AND tenant_id=${scope.tenantId} LIMIT 1`;
  const p = r.rows[0];
  if (!p) return null;
  let authors = [];
  try { authors = JSON.parse(p.authors || "[]"); } catch {}
  return {
    type: "paper", doi: p.doi, title: p.title, published: p.published,
    citations: p.citation_count, journal: p.journal,
    authors: authors.map(a => typeof a === "string" ? { name: a } : a),
  };
}

module.exports = { authorDetail, institutionDetail, journalDetail, paperDetail };

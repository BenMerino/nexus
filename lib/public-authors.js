const { sql } = require("@vercel/postgres");
const { calculateHIndex } = require("./h-index");

async function getAuthorsDirectory(tenantId) {
  const agg = await sql`
    SELECT COALESCE(t.ext_id, t.value) AS author_id,
           MAX(t.value) AS name,
           MAX(t.ext_id) AS orcid,
           COUNT(*) AS paper_count,
           COALESCE(SUM(d.citation_count), 0) AS total_citations
    FROM tags t
    JOIN doi_records d ON d.id = t.doi_record_id
    WHERE t.category = 'author' AND d.tenant_id = ${tenantId}
    GROUP BY COALESCE(t.ext_id, t.value)
    ORDER BY paper_count DESC`;

  const cites = await sql`
    SELECT COALESCE(t.ext_id, t.value) AS author_id,
           COALESCE(d.citation_count, 0) AS citations
    FROM tags t
    JOIN doi_records d ON d.id = t.doi_record_id
    WHERE t.category = 'author' AND d.tenant_id = ${tenantId}`;

  const papersByAuthor = new Map();
  for (const row of cites.rows) {
    const k = row.author_id;
    if (!papersByAuthor.has(k)) papersByAuthor.set(k, []);
    papersByAuthor.get(k).push(parseInt(row.citations));
  }

  return agg.rows.map(row => ({
    name: row.name,
    orcid: row.orcid || null,
    paperCount: parseInt(row.paper_count),
    totalCitations: parseInt(row.total_citations),
    hIndex: calculateHIndex(papersByAuthor.get(row.author_id) || []),
  }));
}

module.exports = { getAuthorsDirectory };

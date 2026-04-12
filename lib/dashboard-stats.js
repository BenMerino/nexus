const { sql } = require("@vercel/postgres");

async function getSummary() {
  const r = await sql`
    SELECT COUNT(*) as total_pubs,
           COALESCE(SUM(citation_count), 0) as total_citations,
           COUNT(DISTINCT CASE WHEN open_access THEN doi END) as oa_count
    FROM doi_records`;
  const authors = await sql`
    SELECT COUNT(DISTINCT value) as count FROM tags WHERE category = 'author'`;
  const row = r.rows[0];
  return {
    totalPubs: parseInt(row.total_pubs),
    totalCitations: parseInt(row.total_citations),
    oaCount: parseInt(row.oa_count),
    authorCount: parseInt(authors.rows[0].count),
  };
}

async function getByYearAndSource() {
  const r = await sql`
    SELECT y.value as year, COALESCE(s.value, 'Other') as source, COUNT(*) as count
    FROM tags y
    JOIN doi_records d ON y.doi_record_id = d.id
    LEFT JOIN tags s ON s.doi_record_id = d.id AND s.category = 'source'
    WHERE y.category = 'year'
    GROUP BY y.value, s.value
    ORDER BY y.value`;
  return r.rows;
}

async function getCollaborations() {
  const r = await sql`
    SELECT value, COUNT(*) as count
    FROM tags WHERE category = 'institution'
    GROUP BY value ORDER BY count DESC LIMIT 20`;
  return r.rows;
}

async function getCountries() {
  const r = await sql`SELECT affiliations FROM doi_records WHERE affiliations IS NOT NULL`;
  const countryCounts = {};
  for (const row of r.rows) {
    try {
      const affs = JSON.parse(row.affiliations);
      for (const author of affs) {
        for (const aff of author.affiliations || []) {
          const country = aff.country;
          if (country) countryCounts[country] = (countryCounts[country] || 0) + 1;
        }
      }
    } catch {}
  }
  return Object.entries(countryCounts)
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
}

module.exports = { getSummary, getByYearAndSource, getCollaborations, getCountries };

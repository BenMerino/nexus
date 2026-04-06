const { sql } = require("@vercel/postgres");

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'by', 'from', 'is', 'was', 'are', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'shall',
  'not', 'no', 'this', 'that', 'these', 'those', 'it', 'its', 'we', 'our', 'they', 'their',
  'as', 'if', 'than', 'so', 'such', 'both', 'each', 'all', 'any', 'more', 'most', 'other',
  'into', 'through', 'during', 'before', 'after', 'between', 'about', 'which', 'who', 'what',
  'also', 'however', 'using', 'based', 'two', 'one', 'new', 'results', 'study', 'method',
]);

function extractKeywords(text, topN = 3) {
  if (!text) return [];
  const words = text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(w => w.length > 3);
  const freq = {};
  for (const w of words) {
    if (!STOPWORDS.has(w)) freq[w] = (freq[w] || 0) + 1;
  }
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, topN).map(([w]) => w);
}

async function getGraphMetadata() {
  const { rows } = await sql`
    SELECT
      t.category || ':' || t.value AS tag_id,
      AVG(COALESCE(d.citation_count, 0)) AS avg_citations,
      MAX(COALESCE(d.citation_count, 0)) AS max_citations,
      CAST(SUM(CASE WHEN d.open_access THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) AS oa_pct,
      STRING_AGG(d.abstract, ' ||| ') AS abstracts
    FROM tags t
    JOIN doi_records d ON d.id = t.doi_record_id
    GROUP BY t.category, t.value`;

  const tagMeta = {};
  for (const r of rows) {
    const abstracts = (r.abstracts || '').split(' ||| ').filter(Boolean).join(' ');
    tagMeta[r.tag_id] = {
      avgCitations: Math.round(r.avg_citations * 10) / 10,
      maxCitations: r.max_citations,
      openAccessPct: Math.round(r.oa_pct * 100) / 100,
      topKeywords: extractKeywords(abstracts),
    };
  }
  return { tagMeta };
}

module.exports = { getGraphMetadata };

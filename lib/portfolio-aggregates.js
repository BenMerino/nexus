const { sql } = require("@vercel/postgres");

async function getTopConcepts(recordIds, limit = 8) {
  if (!recordIds.length) return [];
  const r = await sql.query(
    `SELECT display_name AS name, source,
       COUNT(DISTINCT doi_record_id)::int AS works,
       AVG(score)::real AS avg_score
     FROM doi_concepts
     WHERE doi_record_id = ANY($1::int[]) AND source = 'openalex'
     GROUP BY display_name, source
     ORDER BY works DESC, avg_score DESC
     LIMIT $2`,
    [recordIds, limit]
  );
  return r.rows.map(row => ({
    name: row.name, works: row.works, score: row.avg_score,
  }));
}

function buildCadence(works, span = 8) {
  const currentYear = new Date().getFullYear();
  const startYear = currentYear - span + 1;
  const counts = new Map();
  for (const w of works) {
    if (!w.year) continue;
    const y = parseInt(String(w.year).slice(0, 4), 10);
    if (!Number.isFinite(y) || y < startYear || y > currentYear) continue;
    counts.set(y, (counts.get(y) || 0) + 1);
  }
  const series = [];
  for (let y = startYear; y <= currentYear; y++) {
    series.push({ year: y, count: counts.get(y) || 0 });
  }
  const totalInWindow = series.reduce((s, p) => s + p.count, 0);
  const meanPerYear = totalInWindow / span;
  return { series, meanPerYear: Math.round(meanPerYear * 10) / 10 };
}

function topCited(works, limit = 5) {
  return [...works]
    .filter(w => w.citation_count != null)
    .sort((a, b) => (b.citation_count || 0) - (a.citation_count || 0))
    .slice(0, limit)
    .map(w => ({
      doi: w.doi, title: w.title, year: w.year, citation_count: w.citation_count,
    }));
}

module.exports = { getTopConcepts, buildCadence, topCited };

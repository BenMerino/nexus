const { sql } = require("@vercel/postgres");
const { isPreprint } = require("./h-index");

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
  const byYearType = new Map();
  const typesSeen = new Set();
  for (const w of works) {
    if (!w.year) continue;
    if (isPreprint(w)) continue;
    const y = parseInt(String(w.year).slice(0, 4), 10);
    if (!Number.isFinite(y) || y < startYear || y > currentYear) continue;
    const t = w.type || "unknown";
    typesSeen.add(t);
    if (!byYearType.has(y)) byYearType.set(y, new Map());
    const row = byYearType.get(y);
    row.set(t, (row.get(t) || 0) + 1);
  }
  const types = Array.from(typesSeen).sort();
  const series = [];
  for (let y = startYear; y <= currentYear; y++) {
    const row = byYearType.get(y) || new Map();
    const segments = types.map(t => ({ type: t, count: row.get(t) || 0 }));
    const count = segments.reduce((s, seg) => s + seg.count, 0);
    series.push({ year: y, count, segments });
  }
  const totalInWindow = series.reduce((s, p) => s + p.count, 0);
  const meanPerYear = totalInWindow / span;
  return { series, types, meanPerYear: Math.round(meanPerYear * 10) / 10 };
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

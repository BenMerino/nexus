const { sql } = require("./sql");
const { resolvePubFilter } = require("./stats-scope");
const { getRecentPapers } = require("./dashboard-stats");

// Public works lists for the tenant page: the corpus's most-cited papers and
// its latest output. Same scope contract as the other public stats readers —
// {tenantId, role:'public', unitKey?} narrowed via resolvePubFilter, so the
// lists re-scope to a faculty/department like every other panel.

async function getTopCited(scope, limit = 8) {
  const f = await resolvePubFilter(scope);
  const r = await sql.query(
    `SELECT p.doi, p.title, p.published, p.citation_count, p.type,
       (SELECT v.name FROM published_in pi JOIN venues v ON v.id = pi.venue_id
        WHERE pi.publication_id = p.id AND v.venue_type = 'journal' LIMIT 1) journal
     FROM publications p WHERE p.citation_count > 0 AND ${f.where}
     ORDER BY p.citation_count DESC LIMIT ${limit}`, f.params);
  return r.rows;
}

function rowToWork(r) {
  return {
    doi: r.doi || null,
    title: r.title || null,
    year: r.published ? String(r.published).slice(0, 4) : null,
    journal: r.journal || null,
    type: r.type || null,
    citations: parseInt(r.citation_count) || 0,
  };
}

async function getPublicWorks(scope) {
  const [topCited, recent] = await Promise.all([
    getTopCited(scope),
    getRecentPapers(scope),
  ]);
  return { topCited: topCited.map(rowToWork), recent: recent.map(rowToWork) };
}

module.exports = { getPublicWorks };

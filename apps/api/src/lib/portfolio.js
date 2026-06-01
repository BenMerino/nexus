const { sql } = require("./sql");
const { computeVelocity, buildVelocitySeries } = require("./portfolio-velocity");
const { getTopConcepts, buildCadence, topCited } = require("./portfolio-aggregates");
const { buildCoauthorGraph } = require("./portfolio-coauthors");

// orcid may arrive bare or prefixed; authors.orcid is stored bare.
function bareOrcid(o) { return o ? String(o).replace(/^https?:\/\/orcid\.org\//, "") : o; }

async function getResearcherWorks(orcid) {
  const r = await sql`
    SELECT d.id, d.doi, d.title, d.published, d.citation_count, d.type
    FROM publications d
    JOIN authorship s ON s.publication_id = d.id
    JOIN authors a ON a.id = s.author_id
    WHERE a.orcid = ${bareOrcid(orcid)}
    ORDER BY d.published DESC NULLS LAST`;
  return r.rows;
}

async function getCitationSeries(recordIds, currentYear, span = 5) {
  if (!recordIds.length) return { series: [], byYear: new Map() };
  const r = await sql.query(
    `SELECT year, SUM(count)::int AS total
     FROM doi_citations_by_year
     WHERE doi_record_id = ANY($1::int[]) AND year >= $2
     GROUP BY year ORDER BY year ASC`,
    [recordIds, currentYear - span + 1]
  );
  const byYear = new Map(r.rows.map(row => [row.year, row.total]));
  const series = [];
  for (let y = currentYear - span + 1; y <= currentYear; y++) {
    series.push({ year: y, total: byYear.get(y) || 0 });
  }
  return { series, byYear };
}

async function findCollaborators(orcid, tenantId, limit = 10) {
  const r = await sql.query(
    `WITH target_records AS (
       SELECT DISTINCT t.doi_record_id
       FROM tags t WHERE t.category = 'author' AND t.ext_id = $1
     ),
     target_concepts AS (
       SELECT DISTINCT concept_id, source FROM doi_concepts
       WHERE doi_record_id IN (SELECT doi_record_id FROM target_records)
     ),
     existing_coauthors AS (
       SELECT DISTINCT t.ext_id FROM tags t
       WHERE t.category = 'author' AND t.ext_id IS NOT NULL AND t.ext_id <> $1
         AND t.doi_record_id IN (SELECT doi_record_id FROM target_records)
     )
     SELECT u.orcid, u.full_name AS name, u.faculty,
       SUM(CASE WHEN dc.source = 'openalex' THEN 1.0 ELSE 0.5 END) AS shared_score,
       COUNT(DISTINCT dc.concept_id)::int AS shared_count,
       array_agg(DISTINCT dc.display_name) AS shared_concepts
     FROM users u
     JOIN tags t ON t.category = 'author' AND t.ext_id = u.orcid
     JOIN doi_concepts dc ON dc.doi_record_id = t.doi_record_id
     JOIN target_concepts tc ON tc.concept_id = dc.concept_id
     WHERE u.tenant_id = $2 AND u.orcid IS NOT NULL AND u.orcid <> $1
       AND u.orcid NOT IN (SELECT ext_id FROM existing_coauthors)
     GROUP BY u.orcid, u.full_name, u.faculty
     ORDER BY shared_score DESC, shared_count DESC
     LIMIT $3`,
    [orcid, tenantId, limit]
  );
  return r.rows.map(row => ({
    orcid: row.orcid,
    name: row.name,
    faculty: row.faculty,
    sharedConcepts: (row.shared_concepts || []).slice(0, 8),
    sharedCount: row.shared_count,
  }));
}

async function getExistingCoauthors(orcid) {
  const me = bareOrcid(orcid);
  const r = await sql`
    SELECT DISTINCT a2.orcid FROM authors a1
    JOIN authorship s1 ON s1.author_id = a1.id
    JOIN authorship s2 ON s2.publication_id = s1.publication_id
    JOIN authors a2 ON a2.id = s2.author_id AND a2.tenant_id = a1.tenant_id
    WHERE a1.orcid = ${me} AND a2.orcid <> ${me}`;
  return r.rows.map(row => row.orcid);
}

async function getResearcherPortfolio(orcid, tenantId) {
  const works = await getResearcherWorks(orcid);
  const recordIds = works.map(w => w.id);
  const now = new Date();
  const currentYear = now.getFullYear();
  const { byYear } = await getCitationSeries(recordIds, currentYear);
  const score = computeVelocity(byYear, currentYear);
  const { series, forecast, trend } = buildVelocitySeries(byYear, currentYear, now);
  const worksOut = works.map(w => ({
    doi: w.doi, title: w.title, year: w.published, citation_count: w.citation_count, type: w.type,
  }));
  const [existing, suggested, concepts, coauthorGraph] = await Promise.all([
    getExistingCoauthors(orcid),
    findCollaborators(orcid, tenantId),
    getTopConcepts(recordIds),
    buildCoauthorGraph(orcid),
  ]);
  return {
    works: worksOut,
    velocity: { series, forecast, score: Math.round(score * 100) / 100, trend },
    collaborators: { existing, suggested },
    concepts,
    cadence: buildCadence(worksOut),
    topCited: topCited(worksOut),
    coauthorGraph,
  };
}

module.exports = {
  computeVelocity, buildVelocitySeries, getResearcherPortfolio,
  getResearcherWorks, getCitationSeries, findCollaborators, getExistingCoauthors,
};


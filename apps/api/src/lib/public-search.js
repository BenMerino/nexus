const { sql } = require("./sql");
const { normRor } = require("./entity-normalize");

// Public omnibox search: researchers + publications in one round-trip.
// (Org units are filtered client-side from the already-cached org-tree
// summary, so they don't hit the server here.) Plain ILIKE — the corpus is
// tens of thousands of rows per tenant, well inside index-free territory.

const MAX_AUTHORS = 6;
const MAX_WORKS = 8;

// Researchers: same population as the public directory — authors affiliated
// with the tenant's home institution (ROR) when one exists, any tenant author
// otherwise — so search results always have a working profile page.
async function searchAuthors(tenantId, tenantRor, q) {
  const ror = tenantRor ? normRor(tenantRor) : null;
  const like = `%${q}%`;
  const r = ror
    ? await sql.query(
        `SELECT a.name, a.orcid, COUNT(DISTINCT af.publication_id) papers
         FROM affiliation af
         JOIN institutions i ON i.id = af.institution_id AND i.tenant_id = $1 AND i.ror = $2
         JOIN authors a ON a.id = af.author_id
         WHERE a.name ILIKE $3 AND a.orcid IS NOT NULL
         GROUP BY a.id, a.name, a.orcid
         ORDER BY papers DESC LIMIT ${MAX_AUTHORS}`, [tenantId, ror, like])
    : await sql.query(
        `SELECT a.name, a.orcid, COUNT(DISTINCT s.publication_id) papers
         FROM authors a JOIN authorship s ON s.author_id = a.id
         WHERE a.tenant_id = $1 AND a.name ILIKE $2 AND a.orcid IS NOT NULL
         GROUP BY a.id, a.name, a.orcid
         ORDER BY papers DESC LIMIT ${MAX_AUTHORS}`, [tenantId, like]);
  return r.rows.map((row) => ({ name: row.name, orcid: row.orcid, papers: parseInt(row.papers) }));
}

async function searchWorks(tenantId, q) {
  const r = await sql.query(
    `SELECT p.title, p.doi, SUBSTRING(p.published FROM 1 FOR 4) AS year,
            p.journal, p.citation_count
     FROM publications p
     WHERE p.tenant_id = $1 AND p.title ILIKE $2
     ORDER BY p.citation_count DESC NULLS LAST LIMIT ${MAX_WORKS}`,
    [tenantId, `%${q}%`]);
  return r.rows.map((row) => ({
    title: row.title, doi: row.doi || null, year: row.year || null,
    journal: row.journal || null, citations: parseInt(row.citation_count) || 0,
  }));
}

async function publicSearch(tenantId, tenantRor, q) {
  const needle = String(q || "").trim();
  if (needle.length < 2) return { authors: [], works: [] };
  const [authors, works] = await Promise.all([
    searchAuthors(tenantId, tenantRor, needle),
    searchWorks(tenantId, needle),
  ]);
  return { authors, works };
}

module.exports = { publicSearch };

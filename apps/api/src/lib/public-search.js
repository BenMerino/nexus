const { sql } = require("./sql");
const { normRor } = require("./entity-normalize");

// Public omnibox search: researchers + publications in one round-trip.
// (Org units are filtered client-side from the already-cached org-tree
// summary, so they don't hit the server here.) Plain ILIKE — the corpus is
// tens of thousands of rows per tenant, well inside index-free territory.

const MAX_AUTHORS = 6;
const MAX_WORKS = 8;
const MAX_TOKENS = 6; // ignore pathological many-word queries

// Tokenize the query and build an AND-of-ILIKE clause over `col`, so word
// ORDER and spacing don't matter: "Rivera Marco", "marco r", and "González
// energía" all match a name/title containing every token. Returns the SQL
// fragment plus the `%token%` params, numbered from `startIdx`. A single
// whole-phrase ILIKE (the old approach) missed reordered names entirely and
// returned zero works for any multi-word person query.
function tokenClause(col, q, startIdx) {
  const tokens = q.split(/\s+/).filter(Boolean).slice(0, MAX_TOKENS);
  const params = tokens.map((t) => `%${t}%`);
  const sqlFrag = tokens.map((_, i) => `${col} ILIKE $${startIdx + i}`).join(" AND ");
  return { sql: sqlFrag, params };
}

// Researchers: same population as the public directory — authors affiliated
// with the tenant's home institution (ROR) when one exists, any tenant author
// otherwise — so search results always have a working profile page.
async function searchAuthors(tenantId, tenantRor, q) {
  const ror = tenantRor ? normRor(tenantRor) : null;
  const r = ror
    ? await (() => {
        const tc = tokenClause("a.name", q, 3);
        return sql.query(
          `SELECT a.name, a.orcid, COUNT(DISTINCT af.publication_id) papers
           FROM affiliation af
           JOIN institutions i ON i.id = af.institution_id AND i.tenant_id = $1 AND i.ror = $2
           JOIN authors a ON a.id = af.author_id
           WHERE ${tc.sql} AND a.orcid IS NOT NULL
           GROUP BY a.id, a.name, a.orcid
           ORDER BY papers DESC LIMIT ${MAX_AUTHORS}`, [tenantId, ror, ...tc.params]);
      })()
    : await (() => {
        const tc = tokenClause("a.name", q, 2);
        return sql.query(
          `SELECT a.name, a.orcid, COUNT(DISTINCT s.publication_id) papers
           FROM authors a JOIN authorship s ON s.author_id = a.id
           WHERE a.tenant_id = $1 AND ${tc.sql} AND a.orcid IS NOT NULL
           GROUP BY a.id, a.name, a.orcid
           ORDER BY papers DESC LIMIT ${MAX_AUTHORS}`, [tenantId, ...tc.params]);
      })();
  return r.rows.map((row) => ({ name: row.name, orcid: row.orcid, papers: parseInt(row.papers) }));
}

async function searchWorks(tenantId, q) {
  const tc = tokenClause("p.title", q, 2);
  const r = await sql.query(
    `SELECT p.title, p.doi, SUBSTRING(p.published FROM 1 FOR 4) AS year,
            p.journal, p.citation_count
     FROM publications p
     WHERE p.tenant_id = $1 AND ${tc.sql}
     ORDER BY p.citation_count DESC NULLS LAST LIMIT ${MAX_WORKS}`,
    [tenantId, ...tc.params]);
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

// Journals (venues) listing for the Journals entity page. The venues table
// (name-key identity, ISSN optional) joined to papers via published_in, scoped
// by tenant. Personal-scope users see only venues carrying their own papers;
// admin scope sees the whole tenant. One row per venue with paper/citation
// rollups + the four indexation flags (WoS/Scopus/DOAJ/SciELO).
const { sql } = require("./sql");
const { isPersonalScope } = require("./db");

async function listJournals(scope) {
  const { tenantId, orcid } = scope;
  const personal = isPersonalScope(scope);

  // Personal scope narrows published_in → publications the user authored
  // (authorship by their author row's orcid). Admin sees every tenant paper.
  const rows = personal
    ? await sql`
        SELECT v.id, v.issn_l, v.name, v.venue_type,
               v.in_wos, v.in_scopus, v.in_doaj, v.in_scielo,
               COUNT(DISTINCT p.id) AS paper_count,
               COALESCE(SUM(p.citation_count), 0) AS citation_count
        FROM venues v
        JOIN published_in pi ON pi.venue_id = v.id
        JOIN publications p ON p.id = pi.publication_id
        JOIN authorship a ON a.publication_id = p.id
        JOIN authors au ON au.id = a.author_id AND au.orcid = ${orcid}
        WHERE v.tenant_id = ${tenantId}
        GROUP BY v.id
        ORDER BY paper_count DESC, v.name ASC`
    : await sql`
        SELECT v.id, v.issn_l, v.name, v.venue_type,
               v.in_wos, v.in_scopus, v.in_doaj, v.in_scielo,
               COUNT(DISTINCT p.id) AS paper_count,
               COALESCE(SUM(p.citation_count), 0) AS citation_count
        FROM venues v
        LEFT JOIN published_in pi ON pi.venue_id = v.id
        LEFT JOIN publications p ON p.id = pi.publication_id
        WHERE v.tenant_id = ${tenantId}
        GROUP BY v.id
        ORDER BY paper_count DESC, v.name ASC`;

  return rows.rows.map((r) => ({
    id: r.id,
    issn: r.issn_l,
    name: r.name,
    type: r.venue_type,
    paperCount: Number(r.paper_count),
    citationCount: Number(r.citation_count),
    indexation: {
      wos: r.in_wos, scopus: r.in_scopus, doaj: r.in_doaj, scielo: r.in_scielo,
    },
  }));
}

module.exports = { listJournals };

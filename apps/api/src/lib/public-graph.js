const { sql } = require("./sql");
const { normRor } = require("./entity-normalize");

const MAX_AUTHORS = 80;
const MAX_INSTITUTIONS = 40;

// normRor as a SQL expression: strip the ror.org/ prefix (case-insensitive,
// matching entity-normalize.normRor's /i regex), trim, NULL-if-empty. Used for
// the home-institution exclusion so it matches the JS path exactly.
const NORM_ROR = (col) =>
  `NULLIF(btrim(regexp_replace(${col}, '^https?://ror\\.org/', '', 'i')), '')`;

// Public collaboration graph (entities). Authors = those affiliated with the
// tenant's institution (the `affiliation` pub↔author↔institution edge, which
// reproduces the old affiliations-JSON ROR filter exactly). Institution nodes =
// every OTHER institution on those authors' papers (`affiliated_with`, excluding
// the tenant's own ROR). Edges = author↔institution paper co-occurrence.
//
// All ranking + co-occurrence runs in SQL (Zincro StatsLeaderboardLogic
// pattern): edge weights are a GROUP BY over a join, not an O(authors ×
// institutions × papers) intersection loop in Node. Node membership, edge
// values, and node-array order (authors ranked, then institutions ranked) match
// the previous JS implementation; ties break by id so the result is stable.
async function buildPublicGraph(tenantId, tenantRor) {
  const ror = tenantRor ? normRor(tenantRor) : null;

  // (paper, author, name) the author is affiliated with the tenant on. With a
  // ROR, scope through the `affiliation` edge to that institution; otherwise
  // every authorship in the tenant. author_id = a.orcid. Built as text+params
  // so it can be composed into the CTE (the sql tag can't nest subqueries).
  const authorSrc = ror
    ? {
        text: `SELECT af.publication_id AS paper, a.orcid AS author_id, a.name
               FROM affiliation af
               JOIN institutions i ON i.id = af.institution_id AND i.tenant_id = $1 AND i.ror = $2
               JOIN authors a ON a.id = af.author_id`,
        params: [tenantId, ror],
      }
    : {
        text: `SELECT s.publication_id AS paper, a.orcid AS author_id, a.name
               FROM authorship s JOIN authors a ON a.id = s.author_id AND a.tenant_id = $1`,
        params: [tenantId],
      };

  // Remaining placeholders continue after authorSrc's params.
  const p = authorSrc.params.length; // 2 (with ror) or 1 (without)
  const $tenant = `$${p + 1}`;
  const $ror = `$${p + 2}`;
  const $maxA = `$${p + 3}`;
  const $maxI = `$${p + 4}`;
  const params = [...authorSrc.params, tenantId, ror, MAX_AUTHORS, MAX_INSTITUTIONS];

  const text = `
    WITH author_papers AS (
      SELECT DISTINCT author_id, paper, name FROM (${authorSrc.text}) src
    ),
    inst_papers AS (
      SELECT DISTINCT aw.publication_id AS paper, i.ror AS inst_id, i.name
      FROM affiliated_with aw
      JOIN institutions i ON i.id = aw.institution_id
      WHERE i.tenant_id = ${$tenant}
        AND (${$ror}::text IS NULL OR ${NORM_ROR("i.ror")} IS DISTINCT FROM ${$ror})
    ),
    top_authors AS (
      SELECT author_id, MIN(name) AS name, COUNT(DISTINCT paper) AS papers
      FROM author_papers GROUP BY author_id
      ORDER BY papers DESC, author_id ASC LIMIT ${$maxA}
    ),
    top_insts AS (
      SELECT inst_id, MIN(name) AS name, COUNT(DISTINCT paper) AS papers
      FROM inst_papers GROUP BY inst_id
      ORDER BY papers DESC, inst_id ASC LIMIT ${$maxI}
    ),
    graph_edges AS (
      SELECT ap.author_id, ip.inst_id, COUNT(DISTINCT ap.paper) AS weight
      FROM author_papers ap
      JOIN top_authors ta ON ta.author_id = ap.author_id
      JOIN inst_papers ip ON ip.paper = ap.paper
      JOIN top_insts ti ON ti.inst_id = ip.inst_id
      GROUP BY ap.author_id, ip.inst_id
    )
    SELECT
      (SELECT json_agg(json_build_object('id', author_id, 'name', name)
              ORDER BY papers DESC, author_id ASC) FROM top_authors) AS authors,
      (SELECT json_agg(json_build_object('id', inst_id, 'name', name)
              ORDER BY papers DESC, inst_id ASC) FROM top_insts) AS insts,
      (SELECT json_agg(json_build_object('a', author_id, 'i', inst_id, 'w', weight))
       FROM graph_edges) AS edges`;

  const result = await sql.query(text, params);
  const row = result.rows[0] || {};
  const authors = row.authors || [];
  const insts = row.insts || [];
  const rawEdges = row.edges || [];

  const nodes = [];
  for (const a of authors) {
    nodes.push({ id: `author:${a.id}`, label: a.name, group: "author", ext_id: a.id || null });
  }
  for (const i of insts) {
    nodes.push({ id: `institution:${i.id}`, label: i.name, group: "institution", ext_id: i.id || null });
  }

  const edges = rawEdges.map((e) => ({
    source: `author:${e.a}`,
    target: `institution:${e.i}`,
    weight: Number(e.w),
  }));

  return { nodes, edges };
}

module.exports = { buildPublicGraph };

// Entity-derived replacement for getAllTags(scope) in the graph builder. Emits
// the SAME {category, value, ext_id, doi, title, published} row shape the old
// tag stream did, but sourced from the entity/edge tables — so the unchanged
// buildGraph assembly reproduces identical nodes/edges by construction.
//
// Category mapping (see docs/HANDOFF-tags-migration.md):
//   author       → authorship + authors            (ext_id = bare orcid)
//   journal /     → published_in + venues           (ext_id = canonical issn_l,
//   non-journal      venue_type drives the category; repository venues are
//                    emitted as 'repository' so the graph's preprint filter sees them)
//   institution  → affiliated_with + institutions   (ext_id = bare ror)
//   type         → publications.type                (value only, no ext_id)
//   indexed_in   → venues.in_* flags via published_in (value = source name)
// DROPPED vs tags: 'source' (3 vestigial nodes, no entity table).

const { sql } = require("./sql");
const { isPersonalScope } = require("./scope");
const { normOrcid } = require("./entity-normalize");

// Personal scope narrows to the user's own publications (by authorship ORCID);
// admin scope is the whole tenant. One pub-id set, reused by every category.
async function scopedPubIds(scope) {
  if (isPersonalScope(scope)) {
    const r = await sql`
      SELECT s.publication_id AS id FROM authorship s JOIN authors a ON a.id = s.author_id
      WHERE a.orcid = ${normOrcid(scope.orcid)} AND a.tenant_id = ${scope.tenantId}`;
    return r.rows.map((x) => x.id);
  }
  const r = await sql`SELECT id FROM publications WHERE tenant_id = ${scope.tenantId}`;
  return r.rows.map((x) => x.id);
}

// Emit entity-derived rows for the given publication ids. Returns the array of
// {category, value, ext_id, doi, title, published} the graph builder consumes.
async function entityGraphRows(scope) {
  const ids = await scopedPubIds(scope);
  if (!ids.length) return [];
  const t = scope.tenantId;
  const rows = [];
  const push = (category, value, ext_id, p) =>
    rows.push({ category, value, ext_id, doi: p.doi, title: p.title, published: p.published });

  // author — bare orcid in ext_id (matches old node-id form, which was AS-IS bare).
  for (const r of (await sql`
    SELECT a.name, a.orcid, p.doi, p.title, p.published
    FROM authorship s JOIN authors a ON a.id = s.author_id
    JOIN publications p ON p.id = s.publication_id
    WHERE p.id = ANY(${ids}) AND a.tenant_id = ${t}`).rows)
    push("author", r.name, r.orcid, r);

  // journal / non-journal / repository — venue_type is the category; ext_id is
  // the canonical issn_l (siblings already collapsed in venues).
  // Only journal/non-journal venues become nodes; repository-venue papers are
  // excluded via publications.is_repository (below), matching the old graph
  // where repository papers contributed no nodes.
  for (const r of (await sql`
    SELECT v.name, v.issn_l, v.venue_type, p.doi, p.title, p.published
    FROM published_in pi JOIN venues v ON v.id = pi.venue_id
    JOIN publications p ON p.id = pi.publication_id
    WHERE p.id = ANY(${ids}) AND v.tenant_id = ${t}
      AND v.venue_type IN ('journal', 'non-journal')`).rows)
    push(r.venue_type, r.name, r.issn_l, r);

  // institution — direct pub↔institution edge (affiliated_with), bare ror.
  for (const r of (await sql`
    SELECT i.name, i.ror, p.doi, p.title, p.published
    FROM affiliated_with aw JOIN institutions i ON i.id = aw.institution_id
    JOIN publications p ON p.id = aw.publication_id
    WHERE p.id = ANY(${ids}) AND i.tenant_id = ${t}`).rows)
    push("institution", r.name, r.ror, r);

  // type — straight off publications (already canonicalized at ingest).
  // is_repository is the per-paper repository-deposit signal (migration 007):
  // emit a 'repository' row so assembleGraph's preprint/repository exclusion
  // drops the paper, exactly as the old `repository` tag did.
  for (const r of (await sql`
    SELECT type, is_repository, doi, title, published FROM publications
    WHERE id = ANY(${ids})`).rows) {
    if (r.type) push("type", r.type, null, r);
    if (r.is_repository) push("repository", r.title || r.doi, null, r);
  }

  // indexed_in — one row per (venue flag, paper). value = source name; the
  // builder keys these nodes by value (no ext_id), giving 4 source nodes.
  for (const r of (await sql`
    SELECT v.in_wos, v.in_scopus, v.in_doaj, v.in_scielo, p.doi, p.title, p.published
    FROM published_in pi JOIN venues v ON v.id = pi.venue_id
    JOIN publications p ON p.id = pi.publication_id
    WHERE p.id = ANY(${ids}) AND v.tenant_id = ${t}
      AND (v.in_wos OR v.in_scopus OR v.in_doaj OR v.in_scielo)`).rows) {
    if (r.in_wos) push("indexed_in", "WoS", null, r);
    if (r.in_scopus) push("indexed_in", "Scopus", null, r);
    if (r.in_doaj) push("indexed_in", "DOAJ", null, r);
    if (r.in_scielo) push("indexed_in", "SciELO", null, r);
  }

  return rows;
}

module.exports = { entityGraphRows };

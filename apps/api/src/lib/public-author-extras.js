const { sql } = require("./sql");
const { normOrcid } = require("./entity-normalize");

// Per-paper author lists for the public academic profile. Kept out of
// public-author.js so the profile assembly stays one concern per file.

// Cap the authors shipped per paper — hyper-authored physics papers can carry
// hundreds; the page shows a handful and a "+N" anyway.
const MAX_AUTHORS_PER_PAPER = 25;

// publication_id → ordered [{name, orcid}] for the given papers.
async function paperAuthors(paperIds, tenantId) {
  if (!paperIds.length) return new Map();
  const r = await sql.query(
    `SELECT s.publication_id, a.name, a.orcid
     FROM authorship s JOIN authors a ON a.id = s.author_id AND a.tenant_id = $2
     WHERE s.publication_id = ANY($1::int[])
     ORDER BY s.publication_id, s.author_order NULLS LAST, a.name`,
    [paperIds, tenantId]);
  const byPaper = new Map();
  for (const row of r.rows) {
    if (!byPaper.has(row.publication_id)) byPaper.set(row.publication_id, []);
    byPaper.get(row.publication_id).push({ name: row.name, orcid: row.orcid ? normOrcid(row.orcid) : null });
  }
  return byPaper;
}

// The tenant's roster ORCIDs (normalized) — author chips only link to a
// profile when the person is actually on this tenant's roster, so external
// co-authors never become dead links. Roster ORCIDs may carry the
// https://orcid.org/ prefix (CSV import), hence the JS-side normalize.
async function rosterOrcids(tenantId) {
  const { rows } = await sql`
    SELECT orcid FROM users
    WHERE tenant_id = ${tenantId} AND role = 'academic' AND orcid IS NOT NULL`;
  return new Set(rows.map((r) => normOrcid(r.orcid)).filter(Boolean));
}

// Attach `authors` (capped) + `authorsTotal` to each paper (by its `id`),
// flagging roster members (the linkable ones). Mutates the papers in place.
async function attachPaperAuthors(papers, tenantId) {
  const ids = papers.map((p) => p.id).filter(Boolean);
  const [byPaper, roster] = await Promise.all([paperAuthors(ids, tenantId), rosterOrcids(tenantId)]);
  for (const p of papers) {
    const all = byPaper.get(p.id) || [];
    p.authors = all.slice(0, MAX_AUTHORS_PER_PAPER).map((a) => ({
      name: a.name,
      orcid: a.orcid,
      inRoster: !!(a.orcid && roster.has(a.orcid)),
    }));
    p.authorsTotal = all.length;
  }
}

module.exports = { attachPaperAuthors };

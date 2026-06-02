const { sql } = require("./sql");
const { normOrcid } = require("./entity-normalize");

function rorTail(r) {
  if (!r) return null;
  const m = String(r).match(/([^/]+)$/);
  return (m ? m[1] : r).toLowerCase();
}

function pickPrimaryRor(counts) {
  let best = null, bestCount = 0;
  for (const [ror, info] of counts.entries()) {
    if (info.count > bestCount) { best = ror; bestCount = info.count; }
  }
  return best ? { ror: best, name: counts.get(best).name } : null;
}

async function buildCoauthorGraph(orcid) {
  // Co-authors = everyone who shares a paper with `orcid` — authorship self-join
  // (entity model). author_id keyed by bare ORCID (matches the old node ids).
  const r = await sql`
    SELECT s2.publication_id AS paper_id,
           a2.orcid AS author_id,
           a2.name AS name,
           a2.orcid AS orcid
    FROM authorship s1
    JOIN authors a1 ON a1.id = s1.author_id AND a1.orcid = ${normOrcid(orcid)}
    JOIN authorship s2 ON s2.publication_id = s1.publication_id
    JOIN authors a2 ON a2.id = s2.author_id`;

  const papersByAuthor = new Map();
  const meta = new Map();
  for (const row of r.rows) {
    if (!papersByAuthor.has(row.author_id)) papersByAuthor.set(row.author_id, new Set());
    papersByAuthor.get(row.author_id).add(row.paper_id);
    if (!meta.has(row.author_id)) meta.set(row.author_id, { name: row.name, orcid: row.orcid });
  }

  const paperIds = new Set();
  for (const ps of papersByAuthor.values()) for (const p of ps) paperIds.add(p);
  const affRows = paperIds.size
    ? (await sql.query(`SELECT id, affiliations FROM doi_records WHERE id = ANY($1::int[])`, [[...paperIds]])).rows
    : [];
  const affByAuthor = new Map();
  for (const rec of affRows) {
    let list = [];
    try { list = JSON.parse(rec.affiliations) || []; } catch { continue; }
    for (const a of list) {
      const authorId = a.orcid || a.name;
      if (!authorId || !papersByAuthor.has(authorId)) continue;
      if (!affByAuthor.has(authorId)) affByAuthor.set(authorId, new Map());
      const counts = affByAuthor.get(authorId);
      for (const aff of (a.affiliations || [])) {
        const tail = rorTail(aff.ror);
        if (!tail) continue;
        if (!counts.has(tail)) counts.set(tail, { name: aff.name || tail, count: 0 });
        counts.get(tail).count += 1;
      }
    }
  }

  const nodes = [];
  for (const [id, papers] of papersByAuthor.entries()) {
    const m = meta.get(id);
    const aff = affByAuthor.has(id) ? pickPrimaryRor(affByAuthor.get(id)) : null;
    nodes.push({
      id,
      label: m.name || id,
      group: "author",
      weight: papers.size,
      isMe: m.orcid === normOrcid(orcid),
      affiliation: aff,
    });
  }

  const edges = [];
  const ids = [...papersByAuthor.keys()];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = papersByAuthor.get(ids[i]);
      const b = papersByAuthor.get(ids[j]);
      let shared = 0;
      for (const p of a) if (b.has(p)) shared++;
      if (shared > 0) edges.push({ source: ids[i], target: ids[j], weight: shared });
    }
  }
  return { nodes, edges };
}

module.exports = { buildCoauthorGraph };

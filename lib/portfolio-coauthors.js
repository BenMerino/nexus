const { sql } = require("@vercel/postgres");

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
  const r = await sql`
    SELECT t2.doi_record_id AS paper_id,
           COALESCE(t2.ext_id, t2.value) AS author_id,
           t2.value AS name,
           t2.ext_id AS orcid
    FROM tags t1
    JOIN tags t2 ON t2.doi_record_id = t1.doi_record_id
    WHERE t1.category = 'author' AND t1.ext_id = ${orcid}
      AND t2.category = 'author'`;

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
      isMe: m.orcid === orcid,
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

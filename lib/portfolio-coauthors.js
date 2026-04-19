const { sql } = require("@vercel/postgres");

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

  const nodes = [];
  for (const [id, papers] of papersByAuthor.entries()) {
    const m = meta.get(id);
    nodes.push({
      id,
      label: m.name || id,
      group: "author",
      weight: papers.size,
      isMe: m.orcid === orcid,
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

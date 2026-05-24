const { sql } = require("./sql");

// Organization scheme: the tenant's roster as a Faculty -> Department -> people
// hierarchy with metrics per node. Read-only; any authenticated user of the
// tenant may view it (unlike roster admin actions).
//
// One query returns one row per academic (same population as the roster:
// role='academic' AND profile_category IS NOT NULL), with their paper count
// joined from author tags (ext_id = orcid). The tree + per-node metrics are
// assembled in JS so the SQL stays a single flat scan.
async function queryOrgTree(tenantId) {
  const { rows } = await sql`
    SELECT u.faculty, u.department, u.full_name, u.profile_category, u.orcid,
           COALESCE(p.n, 0)::int AS paper_count
    FROM users u
    LEFT JOIN (
      SELECT t.ext_id, COUNT(DISTINCT t.doi_record_id) AS n
      FROM tags t JOIN doi_records d ON t.doi_record_id = d.id
      WHERE t.category = 'author' AND d.tenant_id = ${tenantId}
      GROUP BY t.ext_id
    ) p ON p.ext_id = u.orcid
    WHERE u.tenant_id = ${tenantId} AND u.role = 'academic'
      AND u.profile_category IS NOT NULL
    ORDER BY u.faculty NULLS LAST, u.department NULLS LAST, u.full_name`;

  const UNFILED = "(Unfiled)";
  const facMap = new Map(); // faculty -> { name, depts: Map }

  for (const r of rows) {
    const fac = r.faculty || UNFILED;
    const dep = r.department || UNFILED;
    if (!facMap.has(fac)) facMap.set(fac, { name: fac, depts: new Map() });
    const f = facMap.get(fac);
    if (!f.depts.has(dep)) f.depts.set(dep, { name: dep, people: [] });
    f.depts.get(dep).people.push({
      name: r.full_name,
      category: r.profile_category,
      orcid: r.orcid || null,
      paperCount: r.paper_count,
    });
  }

  // roll metrics up: per-node headcount, ORCID coverage, paper total.
  const faculties = [];
  let tHead = 0, tOrcid = 0, tPapers = 0;
  for (const f of facMap.values()) {
    const depts = [];
    let fHead = 0, fOrcid = 0, fPapers = 0;
    for (const d of f.depts.values()) {
      const head = d.people.length;
      const withOrcid = d.people.filter((x) => x.orcid).length;
      const papers = d.people.reduce((s, x) => s + x.paperCount, 0);
      depts.push({ name: d.name, headcount: head, withOrcid, papers, people: d.people });
      fHead += head; fOrcid += withOrcid; fPapers += papers;
    }
    depts.sort((a, b) => b.headcount - a.headcount || a.name.localeCompare(b.name));
    faculties.push({ name: f.name, headcount: fHead, withOrcid: fOrcid, papers: fPapers, departments: depts });
    tHead += fHead; tOrcid += fOrcid; tPapers += fPapers;
  }
  faculties.sort((a, b) => b.headcount - a.headcount || a.name.localeCompare(b.name));

  return {
    totals: { headcount: tHead, withOrcid: tOrcid, papers: tPapers, faculties: faculties.length },
    faculties,
  };
}

module.exports = { queryOrgTree };

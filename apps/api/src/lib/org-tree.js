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

  // Per the official UTalca org chart (RU N°1053-2025), the academic tier is
  // Facultades + Institutos as peers; Programas / Direcciones belong to the
  // administrative branch. Classify each unit so the academic units render as
  // the chart shows them and non-academic units fall into one "Otras unidades"
  // group rather than masquerading as faculties.
  const OTHER = "Otras unidades (no académicas)";
  function classify(faculty) {
    const s = (faculty || "").toLowerCase();
    if (s.startsWith("facultad")) return { group: faculty, kind: "faculty" };
    if (s.startsWith("instituto")) return { group: faculty, kind: "institute" };
    return { group: OTHER, kind: "other", sub: faculty }; // Programas, Direcciones
  }

  const UNFILED = "(sin unidad)";
  const facMap = new Map(); // group name -> { name, kind, depts: Map }

  for (const r of rows) {
    const c = classify(r.faculty);
    const fac = c.group;
    // self-referential leaf (person filed at faculty level) -> "(sin unidad)".
    // For "Otras unidades", keep the real program/direccion name as the dept.
    let dep;
    if (c.kind === "other") dep = c.sub || UNFILED;
    else dep = (!r.department || r.department === r.faculty) ? UNFILED : r.department;

    if (!facMap.has(fac)) facMap.set(fac, { name: fac, kind: c.kind, depts: new Map() });
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
    faculties.push({ name: f.name, kind: f.kind, headcount: fHead, withOrcid: fOrcid, papers: fPapers, departments: depts });
    tHead += fHead; tOrcid += fOrcid; tPapers += fPapers;
  }
  // chart order: Facultades, then Institutos, then "Otras unidades" last;
  // within a kind, larger headcount first.
  const KIND_ORDER = { faculty: 0, institute: 1, other: 2 };
  faculties.sort((a, b) =>
    (KIND_ORDER[a.kind] - KIND_ORDER[b.kind])
    || (b.headcount - a.headcount) || a.name.localeCompare(b.name));

  const facultyCount = faculties.filter((f) => f.kind === "faculty").length;
  const instituteCount = faculties.filter((f) => f.kind === "institute").length;

  return {
    totals: {
      headcount: tHead, withOrcid: tOrcid, papers: tPapers,
      faculties: facultyCount, institutes: instituteCount, units: faculties.length,
    },
    faculties,
  };
}

module.exports = { queryOrgTree };

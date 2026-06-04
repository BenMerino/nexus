const { sql } = require("./sql");
const { OTHER, classifyUnit, unitKeyForNode } = require("./org-units");

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
           COALESCE(p.n, 0)::int AS paper_count,
           COALESCE(p.cites, 0)::int AS citation_count
    FROM users u
    LEFT JOIN (
      -- One row per (author, publication): COUNT papers + SUM their citations.
      -- DISTINCT publication_id first so a duplicate authorship edge can't
      -- double-count a paper or its citations.
      SELECT orcid, COUNT(*) AS n, COALESCE(SUM(citation_count), 0) AS cites
      FROM (
        SELECT DISTINCT a.orcid, s.publication_id, pub.citation_count
        FROM authorship s
        JOIN authors a ON a.id = s.author_id
        JOIN publications pub ON pub.id = s.publication_id
        WHERE a.tenant_id = ${tenantId}
      ) per_pub
      GROUP BY orcid
    ) p ON p.orcid = u.orcid
    WHERE u.tenant_id = ${tenantId} AND u.role = 'academic'
      AND u.profile_category IS NOT NULL
    ORDER BY u.faculty NULLS LAST, u.department NULLS LAST, u.full_name`;

  // Per the official UTalca org chart (RU N°1053-2025), the academic tier is
  // Facultades + Institutos as peers; Programas / Direcciones belong to the
  // administrative branch. `classifyUnit` (shared with the stats unitKey
  // derivation in org-units.js) groups academic units as the chart shows them
  // and folds non-academic units into one "Otras unidades" group.
  const UNFILED = "(sin unidad)";
  const facMap = new Map(); // group name -> { name, kind, depts: Map }

  for (const r of rows) {
    const c = classifyUnit(r.faculty);
    const fac = c.group;
    // self-referential leaf (person filed at faculty level) -> "(sin unidad)".
    // For "Otras unidades", keep the real program/direccion name as the dept.
    let dep;
    if (c.kind === "other") dep = c.sub || UNFILED;
    else dep = (!r.department || r.department === r.faculty) ? UNFILED : r.department;

    if (!facMap.has(fac)) facMap.set(fac, { name: fac, kind: c.kind, depts: new Map() });
    const f = facMap.get(fac);
    // The department literal that the unitKey must encode: for "other" units the
    // node IS the program/direccion (its own literal); otherwise the department.
    const depLiteral = c.kind === "other" ? (c.sub || UNFILED) : dep;
    if (!f.depts.has(dep)) f.depts.set(dep, { name: dep, unitKey: unitKeyForNode(c.kind, fac, depLiteral), people: [] });
    f.depts.get(dep).people.push({
      name: r.full_name,
      category: r.profile_category,
      orcid: r.orcid || null,
      paperCount: r.paper_count,
      citationCount: r.citation_count,
    });
  }

  // roll metrics up: per-node headcount, ORCID coverage, paper total.
  const faculties = [];
  let tHead = 0, tOrcid = 0, tPapers = 0, tCites = 0;
  for (const f of facMap.values()) {
    const depts = [];
    let fHead = 0, fOrcid = 0, fPapers = 0, fCites = 0;
    for (const d of f.depts.values()) {
      const head = d.people.length;
      const withOrcid = d.people.filter((x) => x.orcid).length;
      const papers = d.people.reduce((s, x) => s + x.paperCount, 0);
      const citations = d.people.reduce((s, x) => s + x.citationCount, 0);
      depts.push({ name: d.name, unitKey: d.unitKey, headcount: head, withOrcid, papers, citations, people: d.people });
      fHead += head; fOrcid += withOrcid; fPapers += papers; fCites += citations;
    }
    depts.sort((a, b) => b.headcount - a.headcount || a.name.localeCompare(b.name));
    // "Otras unidades" is a synthetic grouping, not a real unit — no faculty-level
    // key (its children carry their own oth:* keys); academic faculties get fac:*.
    const facUnitKey = f.kind === "other" ? null : unitKeyForNode(f.kind, f.name, null);
    faculties.push({ name: f.name, kind: f.kind, unitKey: facUnitKey, headcount: fHead, withOrcid: fOrcid, papers: fPapers, citations: fCites, departments: depts });
    tHead += fHead; tOrcid += fOrcid; tPapers += fPapers; tCites += fCites;
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
      headcount: tHead, withOrcid: tOrcid, papers: tPapers, citations: tCites,
      faculties: facultyCount, institutes: instituteCount, units: faculties.length,
    },
    faculties,
  };
}

module.exports = { queryOrgTree };

const { sql } = require("@vercel/postgres");
const { ensureSchema } = require("../lib/db");
const { requireScope, isPersonalScope } = require("../lib/scope");

async function papersByTag(scope, category, ext_id, value) {
  const personal = isPersonalScope(scope);
  if (ext_id) {
    return personal
      ? await sql`
          SELECT d.doi, d.title, d.published, d.citation_count, d.journal
          FROM doi_records d
          WHERE d.id IN (SELECT doi_record_id FROM tags WHERE category=${category} AND ext_id=${ext_id})
            AND d.id IN (SELECT doi_record_id FROM tags WHERE category='author' AND ext_id=${scope.orcid})
          ORDER BY d.published DESC NULLS LAST LIMIT 12`
      : await sql`
          SELECT d.doi, d.title, d.published, d.citation_count, d.journal
          FROM doi_records d
          WHERE d.id IN (SELECT doi_record_id FROM tags WHERE category=${category} AND ext_id=${ext_id})
            AND d.tenant_id = ${scope.tenantId}
          ORDER BY d.published DESC NULLS LAST LIMIT 12`;
  }
  return personal
    ? await sql`
        SELECT d.doi, d.title, d.published, d.citation_count, d.journal
        FROM doi_records d
        WHERE d.id IN (SELECT doi_record_id FROM tags WHERE category=${category} AND value=${value})
          AND d.id IN (SELECT doi_record_id FROM tags WHERE category='author' AND ext_id=${scope.orcid})
        ORDER BY d.published DESC NULLS LAST LIMIT 12`
    : await sql`
        SELECT d.doi, d.title, d.published, d.citation_count, d.journal
        FROM doi_records d
        WHERE d.id IN (SELECT doi_record_id FROM tags WHERE category=${category} AND value=${value})
          AND d.tenant_id = ${scope.tenantId}
        ORDER BY d.published DESC NULLS LAST LIMIT 12`;
}

async function authorDetail(scope, ext_id, label) {
  const { rows: papers } = await papersByTag(scope, "author", ext_id, label);
  const citations = papers.reduce((s, p) => s + (p.citation_count || 0), 0);
  let u = null;
  if (ext_id) {
    const r = await sql`SELECT full_name, faculty, position FROM users WHERE orcid = ${ext_id} AND tenant_id = ${scope.tenantId} LIMIT 1`;
    u = r.rows[0] || null;
  }
  return { type: "author", name: u?.full_name || label, orcid: ext_id, faculty: u?.faculty, role: u?.position, papersCount: papers.length, citations, papers };
}

async function institutionDetail(scope, ext_id, label) {
  const { rows: papers } = await papersByTag(scope, "institution", ext_id, label);
  return { type: "institution", name: label, ror: ext_id, papersCount: papers.length, papers };
}

async function journalDetail(scope, ext_id, label) {
  const { rows: papers } = await papersByTag(scope, "journal", ext_id, label);
  return { type: "journal", name: label, issn: ext_id, papersCount: papers.length, papers };
}

async function paperDetail(scope, doi) {
  const personal = isPersonalScope(scope);
  const r = personal
    ? await sql`SELECT doi, title, published, citation_count, journal, authors FROM doi_records
        WHERE doi=${doi} AND id IN (SELECT doi_record_id FROM tags WHERE category='author' AND ext_id=${scope.orcid}) LIMIT 1`
    : await sql`SELECT doi, title, published, citation_count, journal, authors FROM doi_records
        WHERE doi=${doi} AND tenant_id=${scope.tenantId} LIMIT 1`;
  const p = r.rows[0];
  if (!p) return null;
  let authors = [];
  try { authors = JSON.parse(p.authors || "[]"); } catch {}
  return {
    type: "paper", doi: p.doi, title: p.title, published: p.published,
    citations: p.citation_count, journal: p.journal,
    authors: authors.map(a => typeof a === "string" ? { name: a } : a),
  };
}

module.exports = async function handler(req, res) {
  await ensureSchema();
  const scope = await requireScope(req, res);
  if (!scope) return;
  const id = req.query.id;
  if (!id) return res.status(400).json({ error: "id is required" });
  const colonIdx = id.indexOf(":");
  if (colonIdx < 0) return res.status(400).json({ error: "invalid id" });
  const group = id.slice(0, colonIdx);
  const key = id.slice(colonIdx + 1);
  const isOrcid = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(key);
  const isRor   = /^0[0-9a-z]{8}$/.test(key);
  const isIssn  = /^\d{4}-\d{3}[\dX]$/.test(key);
  try {
    let d = null;
    if (group === "author")      d = await authorDetail(scope, isOrcid ? key : null, key);
    else if (group === "institution") d = await institutionDetail(scope, isRor ? key : null, key);
    else if (group === "journal")     d = await journalDetail(scope, isIssn ? key : null, key);
    else if (group === "doi")         d = await paperDetail(scope, key);
    else return res.status(400).json({ error: "unknown group" });
    if (!d) return res.status(404).json({ error: "not found" });
    res.json(d);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

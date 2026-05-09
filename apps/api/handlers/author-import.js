const crypto = require("crypto");
const { sql } = require("../src/lib/sql");
const { requireRole } = require("../src/lib/auth");
const { ensureSchema, insertSubmission } = require("../src/lib/db");
const { fetchAndStore } = require("../src/lib/store");
const { searchAuthors, fetchAuthorWorks, fetchInstitutionAuthors } = require("../src/lib/openalex");
const { createUser } = require("../src/lib/db-users");

function slugUsername(name, orcid) {
  const base = (name || "").toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/(^\.|\.$)/g, "");
  const tail = orcid.slice(-4);
  return (base || "researcher") + "." + tail;
}

module.exports = async function handler(req, res) {
  const session = await requireRole(req, "superadmin");
  if (!session) return res.status(403).json({ error: "Superadmin required" });

  const action = req.query.action;

  // GET ?action=search&q=name
  if (req.method === "GET" && action === "search") {
    const q = req.query.q;
    if (!q) return res.status(400).json({ error: "q is required" });
    const authors = await searchAuthors(q);
    return res.json(authors);
  }

  // GET ?action=institution&ror=...&page=1
  if (req.method === "GET" && action === "institution") {
    const ror = req.query.ror;
    if (!ror) return res.status(400).json({ error: "ror is required" });
    const result = await fetchInstitutionAuthors(ror, parseInt(req.query.page) || 1);
    return res.json(result);
  }

  // GET ?action=works&authorId=A123&page=1
  if (req.method === "GET" && action === "works") {
    const { authorId, page } = req.query;
    if (!authorId) return res.status(400).json({ error: "authorId is required" });
    const result = await fetchAuthorWorks(authorId, parseInt(page) || 1);
    return res.json(result);
  }

  // POST ?action=import-users  body: { ror, tenantId, maxPages? }
  if (req.method === "POST" && action === "import-users") {
    const { ror, tenantId, maxPages = 20, startPage = 1 } = req.body || {};
    if (!ror || !tenantId) return res.status(400).json({ error: "ror and tenantId required" });
    const result = { created: 0, skipped: 0, errors: [], pagesFetched: 0, startPage, lastPage: startPage };
    let page = startPage;
    const endPage = startPage + maxPages - 1;
    while (page <= endPage) {
      const batch = await fetchInstitutionAuthors(ror, page);
      result.pagesFetched++;
      for (const a of batch.authors) {
        if (!a.orcid) { result.skipped++; continue; }
        const exists = await sql`SELECT id FROM users WHERE orcid = ${a.orcid} LIMIT 1`;
        if (exists.rows[0]) { result.skipped++; continue; }
        try {
          await createUser(
            slugUsername(a.name, a.orcid),
            crypto.randomBytes(24).toString("hex"),
            a.name, null, "academic", tenantId, null, null, null, a.orcid
          );
          result.created++;
        } catch (err) { result.errors.push({ orcid: a.orcid, name: a.name, error: err.message }); }
      }
      result.lastPage = page;
      if (!batch.hasMore) { result.done = true; break; }
      page++;
    }
    return res.json(result);
  }

  // POST ?action=import  body: { dois: [...] }
  if (req.method === "POST" && action === "import") {
    await ensureSchema();
    const { dois } = req.body;
    if (!Array.isArray(dois) || !dois.length) {
      return res.status(400).json({ error: "dois array is required" });
    }
    const results = { imported: 0, errors: [] };
    for (const doi of dois) {
      try {
        const subId = await insertSubmission(doi, session.username);
        await fetchAndStore(doi, subId);
        results.imported++;
      } catch (err) {
        results.errors.push({ doi, error: err.message });
      }
    }
    return res.json(results);
  }

  res.status(404).json({ error: "Unknown action" });
};

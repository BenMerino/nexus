const { requireRole } = require("../lib/auth");
const { ensureSchema, insertSubmission } = require("../lib/db");
const { fetchAndStore } = require("../lib/store");
const { searchAuthors, fetchAuthorWorks, fetchInstitutionAuthors } = require("../lib/openalex");

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

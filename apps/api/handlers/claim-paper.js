const { sql } = require("../src/lib/sql");
const { ensureSchema, insertSubmission, getRecordByDoi, insertTag } = require("../src/lib/db");
const { getUserById } = require("../src/lib/db-users");
const { fetchAndStore } = require("../src/lib/store");
const { requireScope } = require("../src/lib/scope");

function cleanDoi(raw) {
  if (!raw) return null;
  return String(raw).trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").replace(/\/$/, "");
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const scope = await requireScope(req, res);
  if (!scope) return;
  if (!scope.orcid) return res.status(400).json({ error: "Your user profile has no ORCID; contact an admin." });

  await ensureSchema();
  const doi = cleanDoi(req.body?.doi);
  if (!doi) return res.status(400).json({ error: "doi is required" });

  try {
    let rec = await getRecordByDoi(doi);
    let ingested = false;
    if (!rec) {
      const submissionId = await insertSubmission(doi, scope.username);
      await fetchAndStore(doi, submissionId);
      rec = await getRecordByDoi(doi);
      ingested = true;
    }
    if (!rec) return res.status(404).json({ error: "Could not resolve DOI (not in Crossref/OpenAlex)" });

    const existing = await sql`
      SELECT 1 FROM tags WHERE doi_record_id = ${rec.id}
      AND category = 'author' AND ext_id = ${scope.orcid} LIMIT 1`;
    let tagged = false;
    if (!existing.rows.length) {
      const user = await getUserById(scope.userId);
      const name = user?.full_name || scope.username;
      await insertTag(rec.id, "author", name, scope.orcid);
      tagged = true;
    }
    res.json({ ok: true, recordId: rec.id, ingested, tagged });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

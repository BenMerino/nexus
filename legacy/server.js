const express = require("express");
const path = require("path");
const {
  db,
  insertSubmission,
  upsertRecord,
  insertTag,
  deleteTagsForRecord,
  deleteRecord,
  deleteSubmissionsForDoi,
  getRecordByDoi,
  getAllRecords,
  getAllTags,
  getSubmissions,
} = require("./db");
const { normalize, extractTags, canonicalize } = require("./normalize");
const { fetchCrossRef, fetchOpenAlex, fetchSemanticScholar, fetchDataCite, unwrap } = require("./fetchers");
const { getGraphMetadata } = require("./graph-meta");

const app = express();
const PORT = 9000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Helper: fetch all sources, normalize, store record + tags
async function fetchAndStore(doi, submissionId) {
  const results = await Promise.allSettled([
    fetchCrossRef(doi), fetchOpenAlex(doi), fetchSemanticScholar(doi), fetchDataCite(doi),
  ]);
  const sources = {
    crossref: unwrap(results[0]), openalex: unwrap(results[1]),
    semanticScholar: unwrap(results[2]), datacite: unwrap(results[3]),
  };
  const record = normalize(doi, sources);

  upsertRecord.run(
    submissionId, record.doi, record.title,
    record.authorNames ? JSON.stringify(record.authorNames) : null,
    record.published, record.journal, record.publisher, record.type,
    record.citationCount, record.openAccess ? 1 : 0, record.openAccessUrl,
    record.abstract, record.venue, record.url,
    record.authors ? JSON.stringify(record.authors) : null,
    JSON.stringify(sources)
  );

  const recordId = getRecordByDoi.get(record.doi).id;
  deleteTagsForRecord.run(recordId);
  const tags = extractTags(record);
  for (const tag of tags) {
    insertTag.run(recordId, tag.category, canonicalize(tag.category, tag.value));
  }

  return { record, sources, tags };
}

// Submit a DOI for checking
app.post("/api/submit", async (req, res) => {
  const { doi, uploader } = req.body;
  if (!doi || !uploader) return res.status(400).json({ error: "doi and uploader are required" });
  const sub = insertSubmission.run(doi, uploader);
  const result = await fetchAndStore(doi, sub.lastInsertRowid);
  res.json(result);
});

// Get all stored records
app.get("/api/records", (req, res) => {
  const records = getAllRecords.all().map((r) => ({
    ...r,
    authors: r.authors ? JSON.parse(r.authors) : [],
    affiliations: r.affiliations ? JSON.parse(r.affiliations) : [],
  }));
  res.json(records);
});

// Re-fetch all existing DOIs to backfill affiliations
app.post("/api/refetch-all", async (req, res) => {
  const records = getAllRecords.all();
  const results = [];
  for (const r of records) {
    try {
      const { record } = await fetchAndStore(r.doi, r.submission_id);
      results.push({ doi: r.doi, status: "ok", authorCount: record.authors?.length || 0 });
    } catch (err) {
      results.push({ doi: r.doi, status: "error", error: err.message });
    }
  }
  res.json({ refetched: results.length, results });
});

// Delete a DOI record (and its tags + submissions)
app.delete("/api/records/:id", (req, res) => {
  const id = Number(req.params.id);
  const record = db.prepare("SELECT doi FROM doi_records WHERE id = ?").get(id);
  if (!record) return res.status(404).json({ error: "Record not found" });
  deleteTagsForRecord.run(id);
  deleteRecord.run(id);
  deleteSubmissionsForDoi.run(record.doi);
  res.json({ deleted: true, doi: record.doi });
});

// Get all submissions
app.get("/api/submissions", (req, res) => { res.json(getSubmissions.all()); });

// Get graph data: nodes (DOIs + tags) and edges (DOI -> tag)
app.get("/api/graph", (req, res) => {
  const tags = getAllTags.all();
  const nodes = new Map();
  const edges = [];
  for (const t of tags) {
    const doiNodeId = `doi:${t.doi}`;
    const tagNodeId = `${t.category}:${t.value}`;
    if (!nodes.has(doiNodeId)) nodes.set(doiNodeId, { id: doiNodeId, label: t.title || t.doi, group: "doi" });
    if (!nodes.has(tagNodeId)) nodes.set(tagNodeId, { id: tagNodeId, label: t.value, group: t.category });
    edges.push({ source: doiNodeId, target: tagNodeId });
  }
  res.json({ nodes: Array.from(nodes.values()), edges });
});

// Get graph metadata (citations, keywords per tag)
app.get("/api/graph-metadata", getGraphMetadata);

// Search records
app.get("/api/search", (req, res) => {
  const q = req.query.q;
  if (!q || q.trim().length === 0) return res.json([]);
  const term = `%${q.trim()}%`;
  const searchRecords = db.prepare(`
    SELECT * FROM doi_records
    WHERE title LIKE ? OR authors LIKE ? OR journal LIKE ? OR doi LIKE ? OR publisher LIKE ? OR venue LIKE ?
    ORDER BY id DESC LIMIT 50
  `);
  const records = searchRecords.all(term, term, term, term, term, term).map((r) => ({
    ...r, authors: r.authors ? JSON.parse(r.authors) : [],
  }));
  res.json(records);
});

// Get tag statistics
app.get("/api/tag-stats", (req, res) => {
  const stats = db.prepare(`
    SELECT category, value, COUNT(*) as count FROM tags
    GROUP BY category, value ORDER BY count DESC
  `).all();
  res.json(stats);
});

app.listen(PORT, () => { console.log(`Nexus running at http://localhost:${PORT}`); });

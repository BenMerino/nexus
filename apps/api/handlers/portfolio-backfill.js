const { sql } = require("../src/lib/sql");
const { requireRole } = require("../src/lib/auth");
const { ensureSchema } = require("../src/lib/db");
const { fetchOpenAlex } = require("../src/lib/fetchers");
const { upsertCitationsByYear, upsertConcepts, deleteConceptsForRecord } = require("../src/lib/db-portfolio");
const { extractKeywords } = require("../src/lib/nlp-keywords");

const BATCH_SIZE = 50;
const POLITE_DELAY_MS = 100;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchWithRetry(doi, attempt = 0) {
  try {
    const r = await fetchOpenAlex(doi);
    if (r.found) return r;
    if (attempt < 2) { await sleep(500 * (attempt + 1)); return fetchWithRetry(doi, attempt + 1); }
    return r;
  } catch (err) {
    if (attempt < 2) { await sleep(1000 * (attempt + 1)); return fetchWithRetry(doi, attempt + 1); }
    throw err;
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const session = await requireRole(req, "superadmin");
  if (!session) return res.status(403).json({ error: "Superadmin required" });
  await ensureSchema();

  const cursor = parseInt(req.query.cursor) || 0;
  const batch = await sql`
    SELECT id, doi, abstract FROM doi_records
    WHERE id > ${cursor}
    ORDER BY id ASC LIMIT ${BATCH_SIZE}`;

  const results = { processed: 0, errors: [], lastId: cursor };
  for (const row of batch.rows) {
    try {
      const oa = await fetchWithRetry(row.doi);
      if (oa.found) {
        await upsertCitationsByYear(row.id, oa.countsByYear || []);
        await deleteConceptsForRecord(row.id, "openalex");
        await upsertConcepts(row.id, oa.concepts || []);
      }
      if (row.abstract) {
        await deleteConceptsForRecord(row.id, "nlp");
        await upsertConcepts(row.id, extractKeywords(row.abstract));
      }
      results.processed++;
    } catch (err) {
      results.errors.push({ id: row.id, doi: row.doi, error: err.message });
    }
    results.lastId = row.id;
    await sleep(POLITE_DELAY_MS);
  }
  results.hasMore = batch.rows.length === BATCH_SIZE;
  res.json(results);
};

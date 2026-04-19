const { sql } = require("@vercel/postgres");
const { requireRole } = require("../lib/auth");
const { ensureSchema } = require("../lib/db");
const { normalize } = require("../lib/normalize");
const { extractTags, canonicalize } = require("../lib/normalize-tags");

const BATCH_SIZE = 100;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const session = await requireRole(req, "superadmin");
  if (!session) return res.status(403).json({ error: "Superadmin required" });
  await ensureSchema();

  const cursor = parseInt(req.query.cursor) || 0;
  const batch = await sql`
    SELECT id, doi, raw_responses FROM doi_records
    WHERE id > ${cursor} AND raw_responses IS NOT NULL
    ORDER BY id ASC LIMIT ${BATCH_SIZE}`;

  const stats = { processed: 0, journalToRepository: 0, addedRepository: 0, lastId: cursor };

  for (const row of batch.rows) {
    let sources;
    try { sources = JSON.parse(row.raw_responses); } catch { continue; }
    const record = normalize(row.doi, sources);
    const newTags = extractTags(record);
    const newJournal = newTags.find(t => t.category === "journal");
    const newRepository = newTags.find(t => t.category === "repository");

    const existing = await sql`
      SELECT id, category, value FROM tags
      WHERE doi_record_id = ${row.id} AND category IN ('journal', 'repository')`;
    const existingJournal = existing.rows.find(t => t.category === "journal");

    if (existingJournal && !newJournal && newRepository) {
      const value = canonicalize("repository", newRepository.value);
      await sql`UPDATE tags SET category = 'repository', value = ${value}, ext_id = ${newRepository.ext_id || null}
                WHERE id = ${existingJournal.id}`;
      stats.journalToRepository++;
    } else if (!existingJournal && !existing.rows.find(t => t.category === "repository") && newRepository) {
      const value = canonicalize("repository", newRepository.value);
      await sql`INSERT INTO tags (doi_record_id, category, value, ext_id)
                VALUES (${row.id}, 'repository', ${value}, ${newRepository.ext_id || null})`;
      stats.addedRepository++;
    }
    stats.processed++;
    stats.lastId = row.id;
  }

  const done = batch.rows.length < BATCH_SIZE;
  res.status(200).json({ ...stats, done, nextCursor: done ? null : stats.lastId });
};

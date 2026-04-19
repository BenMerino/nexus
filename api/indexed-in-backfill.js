const { sql } = require("@vercel/postgres");
const { requireRole } = require("../lib/auth");
const { ensureSchema } = require("../lib/db");
const { tagIndexedInFromOpenAlex } = require("../lib/indexed-backfill");

const BATCH_SIZE = 200;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const session = await requireRole(req, "superadmin");
  if (!session) return res.status(403).json({ error: "Superadmin required" });
  await ensureSchema();

  const cursor = parseInt(req.query.cursor) || 0;
  const batch = await sql`
    SELECT id, raw_responses FROM doi_records
    WHERE id > ${cursor} AND raw_responses IS NOT NULL
    ORDER BY id ASC LIMIT ${BATCH_SIZE}`;

  const stats = { processed: 0, tagged: 0, lastId: cursor };

  for (const row of batch.rows) {
    let sources;
    try { sources = JSON.parse(row.raw_responses); } catch { continue; }
    const oa = sources.openalex;
    const indexedIn = oa?.indexedIn || oa?.indexed_in || [];
    const issnL = oa?.issnL || oa?.primary_location?.source?.issn_l || null;
    const tagged = await tagIndexedInFromOpenAlex(row.id, indexedIn, issnL);
    stats.tagged += tagged.length;
    stats.processed++;
    stats.lastId = row.id;
  }

  const done = batch.rows.length < BATCH_SIZE;
  res.status(200).json({ ...stats, done, nextCursor: done ? null : stats.lastId });
};

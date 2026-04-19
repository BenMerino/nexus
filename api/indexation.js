const { ensureSchema } = require("../lib/db");
const { requireRole } = require("../lib/auth");
const { extractEntries, replaceIndex, listCounts } = require("../lib/indexed-journals");
const { backfillIndexationTags, clearIndexationTagsForSource } = require("../lib/indexed-backfill");
const { seedIndexedJournalsFromOpenAlex } = require("../lib/openalex-to-indexed-journals");

module.exports = async function handler(req, res) {
  await ensureSchema();
  const sa = await requireRole(req, "superadmin");
  if (!sa) return res.status(403).json({ error: "Superadmin required" });

  if (req.method === "GET") {
    return res.json({ counts: await listCounts() });
  }

  if (req.method === "POST" && req.query.action === "seed-from-openalex") {
    const seeded = await seedIndexedJournalsFromOpenAlex();
    const backfill = await backfillIndexationTags();
    return res.json({ ok: true, seeded, backfill });
  }

  if (req.method === "POST") {
    const { csv, source } = req.body || {};
    if (!csv || !source) return res.status(400).json({ error: "csv and source are required" });
    const entries = extractEntries(csv);
    if (!entries.length) return res.status(400).json({ error: "No ISSN-bearing rows found" });
    const imported = await replaceIndex(source, entries);
    await clearIndexationTagsForSource(imported.source);
    const backfill = await backfillIndexationTags();
    return res.json({ ok: true, imported, backfill });
  }

  res.status(405).json({ error: "Method not allowed" });
};

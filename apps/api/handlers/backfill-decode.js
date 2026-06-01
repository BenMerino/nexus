const { sql } = require("../src/lib/sql");
const { ensureSchema, getAllRecords, deleteTagsForRecord, insertTag } = require("../src/lib/db");
const { normalize, extractTags, canonicalize } = require("../src/lib/normalize");
const { decodeEntities } = require("../src/lib/decode-entities");
const { requireScope } = require("../src/lib/scope");

/** One-shot backfill: re-decode HTML entities across every record's stored
 *  scalar fields (title, journal, publisher, abstract, venue) and the JSON
 *  authors column; then rebuild tags from raw_responses so any journal /
 *  author / institution tag values that were stored encoded come out clean.
 *
 *  Idempotent: decodeEntities() is a no-op on already-decoded strings.
 *  Safe to re-run after future ingest changes. */
module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const scope = await requireScope(req, res);
  if (!scope) return;
  if (scope.role !== "admin" && scope.role !== "superadmin") {
    return res.status(403).json({ error: "Admin required" });
  }
  await ensureSchema();

  try {
    const records = await getAllRecords(scope);
    let recordsUpdated = 0;
    let tagsRebuilt = 0;
    let skipped = 0;

    for (const r of records) {
      try {
        const decodedAuthors = decodeAuthorsJson(r.authors);
        await sql`
          UPDATE publications SET
            title     = ${decodeEntities(r.title)},
            journal   = ${decodeEntities(r.journal)},
            publisher = ${decodeEntities(r.publisher)},
            abstract  = ${decodeEntities(r.abstract)},
            venue     = ${decodeEntities(r.venue)},
            authors   = ${decodedAuthors}
          WHERE id = ${r.id}`;
        recordsUpdated++;

        if (r.raw_responses) {
          const sources = typeof r.raw_responses === "string"
            ? JSON.parse(r.raw_responses)
            : r.raw_responses;
          const norm = normalize(r.doi, sources);
          const tags = extractTags(norm);
          await deleteTagsForRecord(r.id);
          for (const tag of tags) {
            await insertTag(r.id, tag.category, canonicalize(tag.category, tag.value), tag.ext_id);
          }
          tagsRebuilt++;
        }
      } catch (e) {
        skipped++;
      }
    }
    res.json({ recordsUpdated, tagsRebuilt, skipped, total: records.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** The authors column stores either a JSON-string or JSON array of
 *  { name, orcid, affiliations } objects. Walk each string field through
 *  decodeEntities and hand back a string (what Postgres jsonb columns
 *  expect when inserted by name). */
function decodeAuthorsJson(raw) {
  if (!raw) return raw;
  let parsed;
  try { parsed = typeof raw === "string" ? JSON.parse(raw) : raw; }
  catch { return raw; }
  if (!Array.isArray(parsed)) return raw;
  const decoded = parsed.map((a) => ({
    ...a,
    name: decodeEntities(a?.name),
    affiliations: Array.isArray(a?.affiliations)
      ? a.affiliations.map((aff) =>
          typeof aff === "string"
            ? decodeEntities(aff)
            : { ...aff, name: decodeEntities(aff?.name) })
      : a?.affiliations,
  }));
  return JSON.stringify(decoded);
}

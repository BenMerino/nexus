const { decodeEntities } = require("./decode-entities");

/** Normalize a journal name for bucketing. Decode HTML entities first, then
 *  lowercase, strip punctuation, collapse whitespace. So "Maderas. Ciencia y
 *  tecnología" and "Maderas Ciencia y tecnología" match, "Industrial &
 *  Engineering" and "Industrial &amp; Engineering" match, etc. */
function journalNameKey(name) {
  if (!name) return "";
  return decodeEntities(name)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Journals are ingested as one tag per ISSN (print + online siblings), which
 *  would otherwise produce separate graph nodes for the same journal. Group
 *  journal tags by their normalized name key and pick one canonical ISSN
 *  (smallest string) so all siblings collapse to a single node. */
function canonicalJournalIssns(tags, synonymMap) {
  const canonical = new Map(); // nameKey → canonical issn
  const byName = new Map();    // nameKey → Set of issns
  for (const t of tags) {
    if (t.category !== "journal" || !t.ext_id) continue;
    const raw = synonymMap.get(`journal:${t.value}`) || t.value;
    const key = journalNameKey(raw);
    if (!key) continue;
    const set = byName.get(key) || new Set();
    set.add(t.ext_id);
    byName.set(key, set);
  }
  for (const [name, set] of byName) {
    canonical.set(name, [...set].sort()[0]);
  }
  return canonical;
}

module.exports = { journalNameKey, canonicalJournalIssns };

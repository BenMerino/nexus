// Shared normalization for the tags → entities backfill + reconciliation.
// Backfill and reconcile MUST agree on these, or the gate is meaningless.

const { journalNameKey } = require("./journal-canon");

// ext_id is stored both bare ("0000-0002-…") and prefixed
// ("https://orcid.org/0000-0002-…"). Canonicalize to bare so variants merge
// into one entity (UNIQUE(orcid, tenant_id)). Same for ROR.
function normOrcid(extId) {
  if (!extId) return null;
  return String(extId).replace(/^https?:\/\/orcid\.org\//i, "").trim();
}
function normRor(extId) {
  if (!extId) return null;
  return String(extId).replace(/^https?:\/\/ror\.org\//i, "").trim();
}

// Collapse journal/venue tag rows to one canonical ISSN-L per normalized name
// key (mirrors journal-canon.canonicalJournalIssns: smallest ISSN wins). Returns
// Map<nameKey, { issn_l, name, venue_type }>. Input rows: {value, ext_id, category?}.
function venueKeyToIssn(rows) {
  const byKey = new Map(); // nameKey → { issns:Set, name, venue_type }
  for (const r of rows) {
    if (!r.ext_id) continue;
    const key = journalNameKey(r.value);
    if (!key) continue;
    // venue_type follows the tag category exactly: journal / repository /
    // non-journal. Only 'journal' counts as a journal in getTopJournals; the
    // earlier default-to-journal mislabeled SSRN (repository) / book series
    // (non-journal) as journals.
    const vtype = r.category === "repository" ? "repository" : r.category === "non-journal" ? "non-journal" : "journal";
    const cur = byKey.get(key) || { issns: new Set(), name: r.value, venue_type: vtype };
    cur.issns.add(String(r.ext_id).trim());
    byKey.set(key, cur);
  }
  const out = new Map();
  for (const [key, v] of byKey) {
    out.set(key, { issn_l: [...v.issns].sort()[0], name: v.name, venue_type: v.venue_type });
  }
  return out;
}

module.exports = { normOrcid, normRor, venueKeyToIssn };

// Rebuild venues.in_* indexation flags from the canonical `indexed_journals`
// table (issn_l → source) — entity-only, NO tags. Used by the superadmin
// indexation-reconcile action (replacing the old clear+rebuild of indexed_in
// tags). A venue is indexed in a source if its own issn_l is registered OR (to
// bridge ISSN siblings, since a venue stores one canonical issn_l) its
// normalized name matches a registered journal's name. Idempotent: resets all
// four flags, then sets from the registry.

const { sql } = require("./sql");
const { journalNameKey } = require("./journal-canon");
const { SOURCE_TO_FLAG, flagsForNameKeys } = require("./venue-flags");

async function rebuildVenueFlags(tenantId) {
  // Registry: issn_l → Set(source), and name-key → Set(source) (sibling bridge).
  const ij = (await sql`SELECT issn_l, source, journal_name FROM indexed_journals`).rows;
  const byIssn = new Map();
  const byName = new Map();
  for (const r of ij) {
    if (!SOURCE_TO_FLAG[r.source]) continue;
    if (r.issn_l) (byIssn.get(r.issn_l) || byIssn.set(r.issn_l, new Set()).get(r.issn_l)).add(r.source);
    const k = journalNameKey(r.journal_name);
    if (k) (byName.get(k) || byName.set(k, new Set()).get(k)).add(r.source);
  }

  await sql`UPDATE venues SET in_wos=FALSE, in_scopus=FALSE, in_doaj=FALSE, in_scielo=FALSE WHERE tenant_id=${tenantId}`;
  const venues = (await sql`SELECT id, issn_l, name_key FROM venues WHERE tenant_id=${tenantId}`).rows;
  let updated = 0;
  for (const v of venues) {
    const srcs = new Set([...(byIssn.get(v.issn_l) || []), ...(byName.get(v.name_key) || [])]);
    const flags = flagsForNameKeys(srcs);
    if (!flags) continue;
    await sql`UPDATE venues SET
      in_wos=${flags.in_wos}, in_scopus=${flags.in_scopus},
      in_doaj=${flags.in_doaj}, in_scielo=${flags.in_scielo} WHERE id=${v.id}`;
    updated++;
  }
  return updated;
}

module.exports = { rebuildVenueFlags };

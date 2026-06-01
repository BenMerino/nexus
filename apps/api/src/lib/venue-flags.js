// Single source of truth for the indexed_in → venues.in_* flag mapping.
// Shared by backfill-venue-flags.js, the ingest dual-write (db-entities.js), and
// the entity-derived graph so they never disagree. The four indexes Nexus
// tracks (Scopus/WoS via OpenAlex flags + CSV; DOAJ; SciELO) map 1:1 to columns.

const SOURCE_TO_FLAG = {
  WoS: "in_wos",
  Scopus: "in_scopus",
  DOAJ: "in_doaj",
  SciELO: "in_scielo",
};

// Set<sourceName> → { in_wos, in_scopus, in_doaj, in_scielo } booleans, or null
// when the venue is in no tracked index (caller skips it / leaves flags FALSE).
function flagsForNameKeys(sourceSet) {
  if (!sourceSet || !sourceSet.size) return null;
  const flags = { in_wos: false, in_scopus: false, in_doaj: false, in_scielo: false };
  for (const src of sourceSet) {
    const col = SOURCE_TO_FLAG[src];
    if (col) flags[col] = true;
  }
  return flags;
}

// Inverse, for the graph: a venue's flag booleans → the index source names it
// carries (in canonical order). Drives the indexed_in:<source> graph nodes.
function sourcesForFlags(venue) {
  const out = [];
  if (venue.in_wos) out.push("WoS");
  if (venue.in_scopus) out.push("Scopus");
  if (venue.in_doaj) out.push("DOAJ");
  if (venue.in_scielo) out.push("SciELO");
  return out;
}

module.exports = { SOURCE_TO_FLAG, flagsForNameKeys, sourcesForFlags };

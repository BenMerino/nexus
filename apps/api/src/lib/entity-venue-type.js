// Entity venue typing for the entity/edge model (distinct from venue-type.js,
// which classifies a venue at ingest into journal/repository/conference/book/…).
// In the entity graph a venue is ONLY 'journal' or 'non-journal' — "repository"
// is a per-paper property (publications.is_repository, the preprint↔published
// dedup signal the graph excludes on), NOT a venue identity. The same venue can
// hold both repository deposits and regular papers, so repository-ness can't
// live on the venue. journal wins for a name-key (an ISSN'd journal stays a
// journal even if a few papers mis-tagged it non-journal/repository).
//
// Shared by db-venues-sync.js (dual-write) and scripts/backfill-venues-namekey.js
// so the live writes and the historical backfill type venues identically.

function entityVenueType(current, tagCategory) {
  if (current === "journal" || tagCategory === "journal") return "journal";
  return "non-journal";
}

module.exports = { entityVenueType };

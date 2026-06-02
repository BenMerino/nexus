-- Schema migration Step 5 (FINAL, DESTRUCTIVE): drop the generic `tags` EAV
-- table and its synonym sidecars. The culmination of the tags→entities
-- migration: every reader was moved to the entity tables (authors/venues/
-- institutions + authorship/published_in/affiliation/affiliated_with edges +
-- publications.type/is_repository + venues.in_* flags) and verified by per-cluster
-- diff harnesses; every writer was repointed or retired; the synonym subsystem
-- became InstitutionGovernor-style entity merges (db-institution-merge.js). At
-- the time of this migration, `grep -rn "FROM tags|JOIN tags|INSERT INTO tags|
-- getAllTags|tag_synonyms|tag_dismissed"` over apps/api/{src,handlers} is empty.
--
-- SCOPE NOTE: this drops ONLY the tag tables. It does NOT touch the `doi_records`
-- compat VIEW (a plain `SELECT * FROM publications`, independent of tags) — ~26
-- readers still use that alias; repointing them to `publications` is a separate
-- effort, out of scope here.
--
-- IRREVERSIBLE. The entity tables are the sole store; `tags` data is not
-- recoverable after this. Gated on explicit human go-ahead.

DROP TABLE IF EXISTS tag_dismissed_pairs;
DROP TABLE IF EXISTS tag_synonyms;
DROP TABLE IF EXISTS tags;

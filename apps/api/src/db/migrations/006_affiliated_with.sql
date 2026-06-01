-- Schema migration: direct publication↔institution edge.
--
-- TWO distinct institution relationships (the entity model was under-modeled
-- with only the first):
--   affiliation      (pub ↔ author ↔ institution) — author-career: which
--                     institution an author was at on this paper (ORCID-required,
--                     from the affiliations JSON). Drives coauthor/community.
--   affiliated_with  (pub ↔ institution, direct) — institutional-output: any
--                     institution (by ROR) involved in the paper, ORCID or not.
--                     A SUPERSET of affiliation's institution set; what the graph
--                     explorer + collaboration counts use. Backfilled from the
--                     institution TAGS (which are emitted per ROR affiliation).
--
-- Modeling both lets graph-builder's institution edges match exactly and frees
-- the generic `tags` table to be dropped. Additive; idempotent.

CREATE TABLE IF NOT EXISTS affiliated_with (
  publication_id INTEGER NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  PRIMARY KEY (publication_id, institution_id)
);

CREATE INDEX IF NOT EXISTS idx_affiliated_with_institution ON affiliated_with(institution_id);

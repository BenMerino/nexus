-- Schema migration: make `venues` ISSN-optional, identified by a normalized
-- name key.
--
-- WHY: the entity model only stored venues that HAVE an ISSN. But ~17k
-- non-journal + ~8k repository tags (conferences, books, institutional repos
-- like arXiv/Apollo, theses) have NULL ISSN — so those venues never made it
-- into `venues`, leaving the graph missing ~4.7k non-journal nodes AND unable
-- to exclude repository papers (the "this is a repository → exclude" signal
-- lived only in the `repository` tag, with no entity representation).
--
-- FIX: a venue's identity is its normalized journal-name key (journal-canon
-- journalNameKey), not its ISSN. ISSN-L becomes optional metadata. This lets an
-- ISSN-less venue have a stable synthetic identity and carries venue_type
-- (journal / non-journal / repository) into entities so the graph's per-paper
-- exclusion works. Identity owned by VenueGovernor.upsert (DGA). Additive +
-- idempotent.
--
-- Existing venues have 0 name_key collisions (verified: 11821 distinct keys),
-- so switching the unique key from (issn_l) to (name_key) is safe. name_key is
-- backfilled by scripts/backfill-venues-namekey.js (JS — needs HTML-entity
-- decode), which also inserts the ISSN-less venues; this migration only does DDL.

ALTER TABLE venues ALTER COLUMN issn_l DROP NOT NULL;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS name_key TEXT;

-- Drop the old ISSN uniqueness (multiple ISSN-less venues would all be NULL;
-- and identity is now the name key). Keep a non-unique index on issn_l for
-- lookups. The constraint name is Postgres's default for UNIQUE(issn_l,tenant).
ALTER TABLE venues DROP CONSTRAINT IF EXISTS venues_issn_l_tenant_id_key;
CREATE INDEX IF NOT EXISTS idx_venues_issn ON venues(issn_l, tenant_id);

-- The new identity. Partial-safe: enforced once name_key is backfilled NOT NULL
-- by the backfill script. Created as a plain UNIQUE here; the backfill fills
-- every existing row's name_key before any dual-write relies on it.
CREATE UNIQUE INDEX IF NOT EXISTS uq_venues_name_key ON venues(name_key, tenant_id);

-- Repository deposit is a PER-PAPER property (the old `repository` tag), not a
-- venue type — a preprint/repository deposit is essentially a duplicate of the
-- eventual published paper, so the graph excludes it. publications.type already
-- carries 'preprint'; this flag carries the repository signal the graph needs
-- and that the PublicationGovernor will later own (preprint↔published dedup).
ALTER TABLE publications ADD COLUMN IF NOT EXISTS is_repository BOOLEAN NOT NULL DEFAULT FALSE;

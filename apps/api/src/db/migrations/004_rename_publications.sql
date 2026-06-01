-- Schema migration Step 0: rename doi_records -> publications, behind a
-- backward-compatible view.
--
-- The aggregate root is a *publication* (a paper), not a "DOI record" — aligns
-- the table name with the DGA domain model (docs/DGA_DESIGN.md).
--
-- SOURCE-OF-TRUTH NOTE: the schema is created by ensureSchema()/db-schema.js
-- (000_baseline is an empty marker), and db-schema.js now creates `publications`
-- + the `doi_records` view natively. So this migration only handles the
-- EXISTING-PROD case where `doi_records` is still a real table. It is guarded
-- to be a no-op on a fresh DB (where publications already exists) and
-- idempotent on re-run.
--
-- RENAME carries the PK, the doi UNIQUE constraint, and all inbound FKs
-- (tags, doi_citations_by_year, doi_concepts) automatically. The 3 writers
-- (upsertRecord, deleteRecord, backfill-decode) are repointed to `publications`
-- in app code, because INSERT ... ON CONFLICT is not supported through a view.

DO $$
BEGIN
  -- Only act if doi_records is still a TABLE (relkind 'r') and publications
  -- doesn't exist yet. On a fresh DB db-schema.js already made publications +
  -- the view, so this whole block is skipped.
  IF EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = 'doi_records' AND c.relkind = 'r' AND n.nspname = 'public'
    )
    AND NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = 'publications' AND n.nspname = 'public'
    )
  THEN
    ALTER TABLE doi_records RENAME TO publications;
    CREATE OR REPLACE VIEW doi_records AS SELECT * FROM publications;
  END IF;
END $$;

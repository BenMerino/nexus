-- Schema migration Step 1: first-class entity + edge tables (dissolving `tags`).
--
-- Additive only — these coexist with `tags`; they are backfilled (Step 2),
-- dual-written on ingest (Step 3), and readers move onto them one at a time
-- (Step 4) before `tags` is dropped (Step 5). Mirrors db-schema.js createTables
-- (the schema source of truth); kept here as the canonical numbered record and
-- so the tables exist on prod independent of ensureSchema ordering. Idempotent.
--
-- Entities keyed by their real-world identifier (ORCID / ISSN-L / ROR), scoped
-- by tenant. Edges FK the real `publications` table (never the doi_records view).

CREATE TABLE IF NOT EXISTS authors (
  id SERIAL PRIMARY KEY,
  orcid TEXT NOT NULL,
  name TEXT NOT NULL,
  tenant_id INTEGER NOT NULL DEFAULT 1,
  UNIQUE (orcid, tenant_id)
);

CREATE TABLE IF NOT EXISTS venues (
  id SERIAL PRIMARY KEY,
  issn_l TEXT NOT NULL,
  name TEXT NOT NULL,
  venue_type TEXT NOT NULL DEFAULT 'journal',
  in_wos BOOLEAN DEFAULT FALSE,
  in_scopus BOOLEAN DEFAULT FALSE,
  in_doaj BOOLEAN DEFAULT FALSE,
  in_scielo BOOLEAN DEFAULT FALSE,
  tenant_id INTEGER NOT NULL DEFAULT 1,
  UNIQUE (issn_l, tenant_id)
);

CREATE TABLE IF NOT EXISTS institutions (
  id SERIAL PRIMARY KEY,
  ror TEXT NOT NULL,
  name TEXT NOT NULL,
  tenant_id INTEGER NOT NULL DEFAULT 1,
  UNIQUE (ror, tenant_id)
);

CREATE TABLE IF NOT EXISTS authorship (
  publication_id INTEGER NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
  author_order INTEGER,
  PRIMARY KEY (publication_id, author_id)
);

CREATE TABLE IF NOT EXISTS published_in (
  publication_id INTEGER NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  PRIMARY KEY (publication_id, venue_id)
);

CREATE TABLE IF NOT EXISTS affiliation (
  publication_id INTEGER NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  PRIMARY KEY (publication_id, author_id, institution_id)
);

CREATE INDEX IF NOT EXISTS idx_authors_tenant ON authors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_venues_tenant ON venues(tenant_id);
CREATE INDEX IF NOT EXISTS idx_institutions_tenant ON institutions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_authorship_author ON authorship(author_id);
CREATE INDEX IF NOT EXISTS idx_published_in_venue ON published_in(venue_id);
CREATE INDEX IF NOT EXISTS idx_affiliation_author ON affiliation(author_id);
CREATE INDEX IF NOT EXISTS idx_affiliation_institution ON affiliation(institution_id);

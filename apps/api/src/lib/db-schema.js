const { sql } = require("./sql");
const { createIndexes } = require("./db-indexes");
const { createClaustroTables } = require("./db-schema-claustro");
const { createEntityTables } = require("./db-schema-entities");
const { addMissingColumns } = require("./db-schema-columns");

async function createTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS tenants (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      parent_id INTEGER REFERENCES tenants(id),
      ror_id TEXT,
      logo_url TEXT,
      primary_color TEXT DEFAULT '#333333',
      secondary_color TEXT DEFAULT '#1565c0',
      slug TEXT UNIQUE,
      active BOOLEAN DEFAULT TRUE
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      full_name TEXT,
      email TEXT,
      role TEXT NOT NULL DEFAULT 'academic',
      tenant_id INTEGER REFERENCES tenants(id),
      position TEXT,
      faculty TEXT,
      titles TEXT,
      orcid TEXT,
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS submissions (
      id SERIAL PRIMARY KEY,
      doi TEXT NOT NULL,
      uploader TEXT NOT NULL,
      tenant_id INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;
  // The publication aggregate root (formerly doi_records — renamed per the DGA
  // domain model). A `doi_records` view (created after this) keeps legacy
  // readers working. FKs reference the real table `publications`, never the view.
  await sql`
    CREATE TABLE IF NOT EXISTS publications (
      id SERIAL PRIMARY KEY,
      submission_id INTEGER NOT NULL REFERENCES submissions(id),
      doi TEXT NOT NULL UNIQUE,
      title TEXT, authors TEXT, published TEXT,
      journal TEXT, publisher TEXT, type TEXT,
      citation_count INTEGER, open_access BOOLEAN DEFAULT FALSE,
      open_access_url TEXT, abstract TEXT, venue TEXT,
      url TEXT, affiliations TEXT, raw_responses TEXT,
      source_indices TEXT,
      tenant_id INTEGER DEFAULT 1
    )`;
  await sql`CREATE OR REPLACE VIEW doi_records AS SELECT * FROM publications`;
  await sql`
    CREATE TABLE IF NOT EXISTS tags (
      id SERIAL PRIMARY KEY,
      doi_record_id INTEGER NOT NULL REFERENCES publications(id),
      category TEXT NOT NULL,
      value TEXT NOT NULL
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS doi_citations_by_year (
      doi_record_id INTEGER NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
      year INTEGER NOT NULL,
      count INTEGER NOT NULL,
      PRIMARY KEY (doi_record_id, year)
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS doi_concepts (
      doi_record_id INTEGER NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
      concept_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'openalex',
      level INTEGER,
      score REAL,
      PRIMARY KEY (doi_record_id, concept_id)
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS tag_synonyms (
      id SERIAL PRIMARY KEY,
      category TEXT NOT NULL,
      variant TEXT NOT NULL,
      canonical TEXT NOT NULL,
      source TEXT DEFAULT 'manual',
      tenant_id INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(category, variant, tenant_id)
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS indexed_journals (
      issn_l TEXT NOT NULL,
      source TEXT NOT NULL,
      journal_name TEXT,
      added_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (issn_l, source)
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS tag_dismissed_pairs (
      id SERIAL PRIMARY KEY,
      category TEXT NOT NULL,
      value_a TEXT NOT NULL,
      value_b TEXT NOT NULL,
      tenant_id INTEGER DEFAULT 1,
      UNIQUE(category, value_a, value_b, tenant_id)
    )`;

  await createEntityTables();
  await createClaustroTables();
}

async function seedDefaultTenant() {
  await sql`
    INSERT INTO tenants (id, name, ror_id, slug)
    VALUES (1, 'Universidad de Talca', 'https://ror.org/01s4gpq44', 'utalca')
    ON CONFLICT (id) DO UPDATE SET ror_id = EXCLUDED.ror_id`;
  await sql`UPDATE tenants SET slug = 'utalca' WHERE id = 1 AND slug IS NULL`;
}
module.exports = { createTables, addMissingColumns, createIndexes, seedDefaultTenant };

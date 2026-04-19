const { sql, db } = require("@vercel/postgres");

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
  await sql`
    CREATE TABLE IF NOT EXISTS doi_records (
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
  await sql`
    CREATE TABLE IF NOT EXISTS tags (
      id SERIAL PRIMARY KEY,
      doi_record_id INTEGER NOT NULL REFERENCES doi_records(id),
      category TEXT NOT NULL,
      value TEXT NOT NULL
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS doi_citations_by_year (
      doi_record_id INTEGER NOT NULL REFERENCES doi_records(id) ON DELETE CASCADE,
      year INTEGER NOT NULL,
      count INTEGER NOT NULL,
      PRIMARY KEY (doi_record_id, year)
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS doi_concepts (
      doi_record_id INTEGER NOT NULL REFERENCES doi_records(id) ON DELETE CASCADE,
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
}

async function addMissingColumns() {
  const safe = async (query) => {
    try { await db.query(query); } catch (err) {
      if (!err.message?.includes("already exists")) throw err;
    }
  };
  await safe("ALTER TABLE doi_records ADD COLUMN IF NOT EXISTS tenant_id INTEGER DEFAULT 1");
  await safe("ALTER TABLE doi_records ADD COLUMN IF NOT EXISTS source_indices TEXT");
  await safe("ALTER TABLE submissions ADD COLUMN IF NOT EXISTS tenant_id INTEGER DEFAULT 1");
  await safe("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#333333'");
  await safe("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS secondary_color TEXT DEFAULT '#1565c0'");
  await safe("ALTER TABLE tag_synonyms ADD COLUMN IF NOT EXISTS tenant_id INTEGER DEFAULT 1");
  await safe("ALTER TABLE tag_synonyms ADD COLUMN IF NOT EXISTS ror_id TEXT");
  await safe("ALTER TABLE tags ADD COLUMN IF NOT EXISTS ext_id TEXT");
  await safe("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES tenants(id)");
  await safe("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS slug TEXT");
  await safe("CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug)");
}

async function createIndexes() {
  await sql`CREATE INDEX IF NOT EXISTS idx_tags_value ON tags(value)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_tags_category ON tags(category)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_doi_records_doi ON doi_records(doi)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_tag_synonyms_lookup ON tag_synonyms(category, variant)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_tags_ext_id ON tags(ext_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_doi_concepts_concept ON doi_concepts(concept_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_indexed_journals_issn ON indexed_journals(issn_l)`;
}

async function seedDefaultTenant() {
  await sql`
    INSERT INTO tenants (id, name, ror_id, slug)
    VALUES (1, 'Universidad de Talca', 'https://ror.org/01s4gpq44', 'utalca')
    ON CONFLICT (id) DO UPDATE SET ror_id = EXCLUDED.ror_id`;
  await sql`UPDATE tenants SET slug = 'utalca' WHERE id = 1 AND slug IS NULL`;
}

module.exports = { createTables, addMissingColumns, createIndexes, seedDefaultTenant };

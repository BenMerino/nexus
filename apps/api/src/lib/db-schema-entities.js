const { sql } = require("./sql");

// DGA entity + edge tables (schema migration: dissolving `tags`).
// First-class entities keyed by their real-world identifier, replacing the
// generic tags EAV rows. Additive: created alongside tags; backfilled and
// dual-written before any reader moves off tags. FKs reference the real
// `publications` table, never the doi_records view. Mirrors migration 005.
async function createEntityTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS authors (
      id SERIAL PRIMARY KEY,
      orcid TEXT NOT NULL,
      name TEXT NOT NULL,
      tenant_id INTEGER NOT NULL DEFAULT 1,
      UNIQUE (orcid, tenant_id)
    )`;
  await sql`
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
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS institutions (
      id SERIAL PRIMARY KEY,
      ror TEXT NOT NULL,
      name TEXT NOT NULL,
      tenant_id INTEGER NOT NULL DEFAULT 1,
      UNIQUE (ror, tenant_id)
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS authorship (
      publication_id INTEGER NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
      author_id INTEGER NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
      author_order INTEGER,
      PRIMARY KEY (publication_id, author_id)
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS published_in (
      publication_id INTEGER NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
      venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
      PRIMARY KEY (publication_id, venue_id)
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS affiliation (
      publication_id INTEGER NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
      author_id INTEGER NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
      institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
      PRIMARY KEY (publication_id, author_id, institution_id)
    )`;
}

module.exports = { createEntityTables };

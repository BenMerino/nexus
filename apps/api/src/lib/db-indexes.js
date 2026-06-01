const { sql } = require("./sql");

async function createIndexes() {
  await sql`CREATE INDEX IF NOT EXISTS idx_tags_value ON tags(value)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_tags_category ON tags(category)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_doi_records_doi ON publications(doi)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_tag_synonyms_lookup ON tag_synonyms(category, variant)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_tags_ext_id ON tags(ext_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_doi_concepts_concept ON doi_concepts(concept_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_indexed_journals_issn ON indexed_journals(issn_l)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_tags_doi_record_id ON tags(doi_record_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_doi_records_tenant_id ON publications(tenant_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_tags_category_ext_id ON tags(category, ext_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_projects_tenant ON projects(tenant_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_projects_dates ON projects(fecha_inicio, fecha_fin)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_proj_inv_project ON project_investigators(project_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_proj_inv_user ON project_investigators(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_users_grado ON users(grado_academico)`;
  // DGA entity + edge tables (UNIQUE constraints already index the identifier;
  // these cover tenant scans + edge traversal in both directions).
  await sql`CREATE INDEX IF NOT EXISTS idx_authors_tenant ON authors(tenant_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_venues_tenant ON venues(tenant_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_institutions_tenant ON institutions(tenant_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_authorship_author ON authorship(author_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_published_in_venue ON published_in(venue_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_affiliation_author ON affiliation(author_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_affiliation_institution ON affiliation(institution_id)`;
}

module.exports = { createIndexes };

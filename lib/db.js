const { sql } = require("@vercel/postgres");

let _schemaReady = null;

async function ensureSchema() {
  if (!_schemaReady) _schemaReady = _createSchema();
  return _schemaReady;
}

async function _createSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS submissions (
      id SERIAL PRIMARY KEY,
      doi TEXT NOT NULL,
      uploader TEXT NOT NULL,
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
      url TEXT, affiliations TEXT, raw_responses TEXT
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS tags (
      id SERIAL PRIMARY KEY,
      doi_record_id INTEGER NOT NULL REFERENCES doi_records(id),
      category TEXT NOT NULL,
      value TEXT NOT NULL
    )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_tags_value ON tags(value)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_tags_category ON tags(category)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_doi_records_doi ON doi_records(doi)`;
}

async function insertSubmission(doi, uploader) {
  const r = await sql`INSERT INTO submissions (doi, uploader) VALUES (${doi}, ${uploader}) RETURNING id`;
  return r.rows[0].id;
}

async function upsertRecord(submissionId, doi, title, authors, published, journal, publisher, type, citationCount, openAccess, openAccessUrl, abstract, venue, url, affiliations, rawResponses) {
  await sql`
    INSERT INTO doi_records (submission_id, doi, title, authors, published, journal, publisher, type, citation_count, open_access, open_access_url, abstract, venue, url, affiliations, raw_responses)
    VALUES (${submissionId}, ${doi}, ${title}, ${authors}, ${published}, ${journal}, ${publisher}, ${type}, ${citationCount}, ${openAccess}, ${openAccessUrl}, ${abstract}, ${venue}, ${url}, ${affiliations}, ${rawResponses})
    ON CONFLICT(doi) DO UPDATE SET
      title=EXCLUDED.title, authors=EXCLUDED.authors, published=EXCLUDED.published,
      journal=EXCLUDED.journal, publisher=EXCLUDED.publisher, type=EXCLUDED.type,
      citation_count=EXCLUDED.citation_count, open_access=EXCLUDED.open_access,
      open_access_url=EXCLUDED.open_access_url, abstract=EXCLUDED.abstract,
      venue=EXCLUDED.venue, url=EXCLUDED.url, affiliations=EXCLUDED.affiliations,
      raw_responses=EXCLUDED.raw_responses`;
}

async function insertTag(recordId, category, value) {
  await sql`INSERT INTO tags (doi_record_id, category, value) VALUES (${recordId}, ${category}, ${value})`;
}

async function deleteTagsForRecord(id) {
  await sql`DELETE FROM tags WHERE doi_record_id = ${id}`;
}

async function deleteRecord(id) {
  await sql`DELETE FROM doi_records WHERE id = ${id}`;
}

async function deleteSubmissionsForDoi(doi) {
  await sql`DELETE FROM submissions WHERE doi = ${doi}`;
}

async function getRecordByDoi(doi) {
  const r = await sql`SELECT id FROM doi_records WHERE doi = ${doi}`;
  return r.rows[0];
}

async function getAllRecords() {
  const r = await sql`SELECT * FROM doi_records ORDER BY id DESC`;
  return r.rows;
}

async function getAllTags() {
  const r = await sql`
    SELECT t.category, t.value, d.doi, d.title
    FROM tags t JOIN doi_records d ON t.doi_record_id = d.id`;
  return r.rows;
}

async function getSubmissions() {
  const r = await sql`
    SELECT s.*, d.title FROM submissions s
    LEFT JOIN doi_records d ON s.doi = d.doi ORDER BY s.created_at DESC`;
  return r.rows;
}

module.exports = {
  ensureSchema, insertSubmission, upsertRecord, insertTag,
  deleteTagsForRecord, deleteRecord, deleteSubmissionsForDoi,
  getRecordByDoi, getAllRecords, getAllTags, getSubmissions,
};

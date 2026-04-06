const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "doi_checker.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    doi TEXT NOT NULL,
    uploader TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS doi_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    submission_id INTEGER NOT NULL REFERENCES submissions(id),
    doi TEXT NOT NULL,
    title TEXT,
    authors TEXT,
    published TEXT,
    journal TEXT,
    publisher TEXT,
    type TEXT,
    citation_count INTEGER,
    open_access INTEGER,
    open_access_url TEXT,
    abstract TEXT,
    venue TEXT,
    url TEXT,
    affiliations TEXT,
    raw_responses TEXT,
    UNIQUE(doi)
  );

  CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    doi_record_id INTEGER NOT NULL REFERENCES doi_records(id),
    category TEXT NOT NULL,
    value TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_tags_value ON tags(value);
  CREATE INDEX IF NOT EXISTS idx_tags_category ON tags(category);
  CREATE INDEX IF NOT EXISTS idx_doi_records_doi ON doi_records(doi);
`);

// Migration: add affiliations column if missing (existing DBs)
const cols = db.prepare("PRAGMA table_info(doi_records)").all();
if (!cols.some((c) => c.name === "affiliations")) {
  db.exec("ALTER TABLE doi_records ADD COLUMN affiliations TEXT");
}

const insertSubmission = db.prepare(
  "INSERT INTO submissions (doi, uploader) VALUES (?, ?)"
);

const upsertRecord = db.prepare(`
  INSERT INTO doi_records (submission_id, doi, title, authors, published, journal, publisher, type, citation_count, open_access, open_access_url, abstract, venue, url, affiliations, raw_responses)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(doi) DO UPDATE SET
    title=excluded.title, authors=excluded.authors, published=excluded.published,
    journal=excluded.journal, publisher=excluded.publisher, type=excluded.type,
    citation_count=excluded.citation_count, open_access=excluded.open_access,
    open_access_url=excluded.open_access_url, abstract=excluded.abstract,
    venue=excluded.venue, url=excluded.url, affiliations=excluded.affiliations,
    raw_responses=excluded.raw_responses
`);

const insertTag = db.prepare(
  "INSERT INTO tags (doi_record_id, category, value) VALUES (?, ?, ?)"
);

const deleteTagsForRecord = db.prepare(
  "DELETE FROM tags WHERE doi_record_id = ?"
);

const getAllRecords = db.prepare("SELECT * FROM doi_records ORDER BY id DESC");

const getAllTags = db.prepare(`
  SELECT t.category, t.value, d.doi, d.title
  FROM tags t JOIN doi_records d ON t.doi_record_id = d.id
`);

const getRecordByDoi = db.prepare("SELECT id FROM doi_records WHERE doi = ?");

const deleteRecord = db.prepare("DELETE FROM doi_records WHERE id = ?");
const deleteSubmissionsForDoi = db.prepare("DELETE FROM submissions WHERE doi = ?");

const getSubmissions = db.prepare(
  "SELECT s.*, d.title FROM submissions s LEFT JOIN doi_records d ON s.doi = d.doi ORDER BY s.created_at DESC"
);

module.exports = {
  db,
  insertSubmission,
  upsertRecord,
  insertTag,
  deleteTagsForRecord,
  deleteRecord,
  deleteSubmissionsForDoi,
  getRecordByDoi,
  getAllRecords,
  getAllTags,
  getSubmissions,
};

const { sql } = require("./sql");
const schema = require("./db-schema");
const { isPersonalScope } = require("./scope");
const { normOrcid } = require("./entity-normalize");

let _schemaReady = null;

async function ensureSchema() {
  if (!_schemaReady) _schemaReady = _createSchema().catch((err) => {
    _schemaReady = null;
    if (err?.code === "23505") return;
    throw err;
  });
  return _schemaReady;
}

async function _createSchema() {
  await schema.createTables();
  await schema.addMissingColumns();
  await schema.createIndexes();
  await schema.seedDefaultTenant();
}

async function getAllRecords(scope) {
  if (!scope) throw new Error("getAllRecords requires scope");
  if (isPersonalScope(scope)) {
    const r = await sql`
      SELECT * FROM doi_records WHERE id IN (
        SELECT s.publication_id FROM authorship s JOIN authors a ON a.id=s.author_id
        WHERE a.orcid=${normOrcid(scope.orcid)}
      ) ORDER BY id DESC`;
    return r.rows;
  }
  const r = await sql`
    SELECT * FROM doi_records WHERE tenant_id = ${scope.tenantId} ORDER BY id DESC`;
  return r.rows;
}

async function getRecordByDoi(doi, scope) {
  if (scope && isPersonalScope(scope)) {
    const r = await sql`SELECT id FROM doi_records WHERE doi = ${doi}
      AND id IN (SELECT s.publication_id FROM authorship s JOIN authors a ON a.id=s.author_id
        WHERE a.orcid=${normOrcid(scope.orcid)})`;
    return r.rows[0];
  }
  const r = await sql`SELECT id FROM doi_records WHERE doi = ${doi}`;
  return r.rows[0];
}

async function getSubmissions(scope) {
  if (!scope) throw new Error("getSubmissions requires scope");
  if (isPersonalScope(scope)) {
    const r = await sql`
      SELECT s.*, d.title FROM submissions s
      LEFT JOIN doi_records d ON s.doi = d.doi
      WHERE d.id IN (
        SELECT au.publication_id FROM authorship au JOIN authors a ON a.id=au.author_id
        WHERE a.orcid=${normOrcid(scope.orcid)}
      ) ORDER BY s.created_at DESC`;
    return r.rows;
  }
  const r = await sql`
    SELECT s.*, d.title FROM submissions s
    LEFT JOIN doi_records d ON s.doi = d.doi
    WHERE d.tenant_id = ${scope.tenantId}
    ORDER BY s.created_at DESC`;
  return r.rows;
}

// --- Write helpers (no scope needed — superadmin-only operations) ---

async function insertSubmission(doi, uploader) {
  const r = await sql`INSERT INTO submissions (doi, uploader) VALUES (${doi}, ${uploader}) RETURNING id`;
  return r.rows[0].id;
}

async function upsertRecord(submissionId, doi, title, authors, published, journal, publisher, type, citationCount, openAccess, openAccessUrl, abstract, venue, url, affiliations, rawResponses) {
  await sql`
    INSERT INTO publications (submission_id, doi, title, authors, published, journal, publisher, type, citation_count, open_access, open_access_url, abstract, venue, url, affiliations, raw_responses)
    VALUES (${submissionId}, ${doi}, ${title}, ${authors}, ${published}, ${journal}, ${publisher}, ${type}, ${citationCount}, ${openAccess}, ${openAccessUrl}, ${abstract}, ${venue}, ${url}, ${affiliations}, ${rawResponses})
    ON CONFLICT(doi) DO UPDATE SET
      title=EXCLUDED.title, authors=EXCLUDED.authors, published=EXCLUDED.published,
      journal=EXCLUDED.journal, publisher=EXCLUDED.publisher, type=EXCLUDED.type,
      citation_count=EXCLUDED.citation_count, open_access=EXCLUDED.open_access,
      open_access_url=EXCLUDED.open_access_url, abstract=EXCLUDED.abstract,
      venue=EXCLUDED.venue, url=EXCLUDED.url, affiliations=EXCLUDED.affiliations,
      raw_responses=EXCLUDED.raw_responses`;
}


async function deleteRecord(id) {
  await sql`DELETE FROM publications WHERE id = ${id}`;
}

async function deleteSubmissionsForDoi(doi) {
  await sql`DELETE FROM submissions WHERE doi = ${doi}`;
}

async function getSetting(key) {
  const r = await sql`SELECT value FROM settings WHERE key = ${key}`;
  return r.rows[0]?.value || null;
}

async function setSetting(key, value) {
  await sql`
    INSERT INTO settings (key, value) VALUES (${key}, ${value})
    ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value`;
}

module.exports = {
  ensureSchema, insertSubmission, upsertRecord,
  deleteRecord, deleteSubmissionsForDoi,
  getRecordByDoi, getAllRecords, getSubmissions,
  getSetting, setSetting,
};

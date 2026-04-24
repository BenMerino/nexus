const { sql } = require("@vercel/postgres");
const schema = require("./db-schema");
const { isPersonalScope } = require("./scope");

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
        SELECT doi_record_id FROM tags WHERE category='author' AND ext_id=${scope.orcid}
      ) ORDER BY id DESC`;
    return r.rows;
  }
  const r = await sql`
    SELECT * FROM doi_records WHERE tenant_id = ${scope.tenantId} ORDER BY id DESC`;
  return r.rows;
}

async function getAllTags(scope) {
  if (!scope) throw new Error("getAllTags requires scope");
  if (isPersonalScope(scope)) {
    const r = await sql`
      SELECT t.category, t.value, t.ext_id, d.doi, d.title, d.published
      FROM tags t JOIN doi_records d ON t.doi_record_id = d.id
      WHERE d.id IN (
        SELECT doi_record_id FROM tags WHERE category='author' AND ext_id=${scope.orcid}
      ) AND t.category IN ('journal', 'author', 'institution', 'repository', 'type')`;
    return r.rows;
  }
  const r = await sql`
    SELECT t.category, t.value, t.ext_id, d.doi, d.title, d.published
    FROM tags t JOIN doi_records d ON t.doi_record_id = d.id
    WHERE d.tenant_id = ${scope.tenantId}`;
  return r.rows;
}

async function getRecordByDoi(doi, scope) {
  if (scope && isPersonalScope(scope)) {
    const r = await sql`SELECT id FROM doi_records WHERE doi = ${doi}
      AND id IN (SELECT doi_record_id FROM tags WHERE category='author' AND ext_id=${scope.orcid})`;
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
        SELECT doi_record_id FROM tags WHERE category='author' AND ext_id=${scope.orcid}
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

async function resolveByExtId(category, extId) {
  if (!extId) return null;
  const r = await sql`SELECT value FROM tags WHERE category = ${category} AND ext_id = ${extId} LIMIT 1`;
  return r.rows[0]?.value || null;
}

async function insertTag(recordId, category, value, extId) {
  const resolved = await resolveByExtId(category, extId);
  const finalValue = resolved || value;
  await sql`INSERT INTO tags (doi_record_id, category, value, ext_id) VALUES (${recordId}, ${category}, ${finalValue}, ${extId || null})`;
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
  ensureSchema, insertSubmission, upsertRecord, insertTag,
  deleteTagsForRecord, deleteRecord, deleteSubmissionsForDoi,
  getRecordByDoi, getAllRecords, getAllTags, getSubmissions,
  getSetting, setSetting,
};

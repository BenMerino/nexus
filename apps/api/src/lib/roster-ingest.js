const { sql } = require("./sql");
const { fetchWorksByOrcid } = require("./openalex");
const { insertSubmission } = require("./db");
const { fetchAndStore } = require("./store");

// Collect every DOI for an ORCID across OpenAlex's paged works response.
// `since` (ISO date, optional) restricts to works indexed on/after it — the
// incremental "what's new" pull the lifecycle refresh uses; omit for a full walk.
async function doisForOrcid(orcid, since = null) {
  const all = new Set();
  let page = 1;
  while (page <= 20) {
    const { dois, hasMore } = await fetchWorksByOrcid(orcid, page, since);
    dois.forEach(d => all.add(d.toLowerCase()));
    if (!hasMore) break;
    page++;
  }
  return [...all];
}

// For each ORCID-resolved academic in the tenant, pull their works from
// OpenAlex and store any DOI not already in the corpus. Records land in
// tenant 1 via the doi_records.tenant_id default (UTalca). uploader is a
// label string for the submissions row.
async function ingestResolved(tenantId, uploader, limit = 25, offset = 0) {
  const { rows: users } = await sql`
    SELECT id, full_name, orcid FROM users
    WHERE tenant_id = ${tenantId} AND orcid IS NOT NULL AND orcid <> ''
    ORDER BY id LIMIT ${limit} OFFSET ${offset}`;

  // total ORCID-linked academics, so the client knows when to stop paging.
  const { rows: countRows } = await sql`
    SELECT COUNT(*)::int AS n FROM users
    WHERE tenant_id = ${tenantId} AND orcid IS NOT NULL AND orcid <> ''`;

  const result = {
    total: countRows[0].n,
    offset,
    nextOffset: offset + users.length,
    processed: users.length,
    doisSeen: 0,
    imported: 0,
    skipped: 0,
    errors: [],
  };
  result.done = result.nextOffset >= result.total;
  for (const u of users) {
    let dois;
    try {
      dois = await doisForOrcid(u.orcid);
    } catch (err) {
      result.errors.push({ orcid: u.orcid, error: err.message });
      continue;
    }
    for (const doi of dois) {
      result.doisSeen++;
      const exists = await sql`SELECT 1 FROM doi_records WHERE doi = ${doi} LIMIT 1`;
      if (exists.rows[0]) { result.skipped++; continue; }
      try {
        const subId = await insertSubmission(doi, uploader);
        await fetchAndStore(doi, subId);
        result.imported++;
      } catch (err) {
        result.errors.push({ doi, error: err.message });
      }
    }
  }
  return result;
}

module.exports = { ingestResolved, doisForOrcid };

// Lifecycle data layer (N4 — SQL for the tenant-data supervisor). Staleness,
// sync stamping, scheduler eligibility, and the tenant-state counts the Assessor
// reads. Staleness drives off the `users` roster (who HAVE an ORCID) LEFT JOIN
// `authors` (who have papers), because a new roster member has no authors row
// until their first paper lands — so we must not key staleness off authors alone.

const { sql } = require("./sql");

const STALE_DAYS = 30;

// Roster ORCIDs that need a refresh: never-synced (no authors row, or null
// last_synced_at) or older than STALE_DAYS. Oldest-first (NULLS first) so the
// bounded refresh always tackles the most stale. Returns {orcid, last_synced_at}.
async function staleOrcids(tenantId, limit = 100) {
  const r = await sql`
    SELECT u.orcid, a.last_synced_at
    FROM users u
    LEFT JOIN authors a ON a.orcid = u.orcid AND a.tenant_id = u.tenant_id
    WHERE u.tenant_id = ${tenantId} AND u.orcid IS NOT NULL AND u.orcid <> ''
      AND (a.last_synced_at IS NULL OR a.last_synced_at < now() - (${STALE_DAYS} || ' days')::interval)
    ORDER BY a.last_synced_at ASC NULLS FIRST
    LIMIT ${limit}`;
  return r.rows;
}

async function staleCount(tenantId) {
  const r = await sql`
    SELECT COUNT(*)::int AS n
    FROM users u
    LEFT JOIN authors a ON a.orcid = u.orcid AND a.tenant_id = u.tenant_id
    WHERE u.tenant_id = ${tenantId} AND u.orcid IS NOT NULL AND u.orcid <> ''
      AND (a.last_synced_at IS NULL OR a.last_synced_at < now() - (${STALE_DAYS} || ' days')::interval)`;
  return r.rows[0].n;
}

// Stamp an author as synced now. Upserts the authors row if absent (a roster
// member whose papers haven't landed yet still gets a freshness anchor), so the
// next staleness scan doesn't re-pick them every tick.
async function stampAuthorSynced(tenantId, orcid, name) {
  await sql`
    INSERT INTO authors (orcid, name, tenant_id, last_synced_at)
    VALUES (${orcid}, ${name || orcid}, ${tenantId}, now())
    ON CONFLICT (orcid, tenant_id) DO UPDATE SET last_synced_at = now()`;
}

async function markTenantLifecycleRun(tenantId) {
  await sql`UPDATE tenants SET last_lifecycle_run_at = now() WHERE id = ${tenantId}`;
}

// The least-recently-serviced eligible tenant (null = never run sorts first).
// minIntervalHours gates re-running a tenant too soon. Returns {id, ror_id} | null.
async function nextEligibleTenant(minIntervalHours = 20) {
  const r = await sql`
    SELECT id, ror_id FROM tenants
    WHERE last_lifecycle_run_at IS NULL
       OR last_lifecycle_run_at < now() - (${minIntervalHours} || ' hours')::interval
    ORDER BY last_lifecycle_run_at ASC NULLS FIRST
    LIMIT 1`;
  return r.rows[0] || null;
}

// Tenant-state counts for the Assessor summary.
async function tenantCounts(tenantId) {
  const r = await sql`
    SELECT
      (SELECT COUNT(*)::int FROM users WHERE tenant_id = ${tenantId} AND orcid IS NOT NULL AND orcid <> '') AS orcid_users,
      (SELECT COUNT(*)::int FROM users WHERE tenant_id = ${tenantId} AND (orcid IS NULL OR orcid = '') AND role = 'academic') AS orcidless_users,
      (SELECT COUNT(*)::int FROM publications WHERE tenant_id = ${tenantId}) AS publications,
      (SELECT COUNT(*)::int FROM authors WHERE tenant_id = ${tenantId}) AS authors,
      (SELECT COUNT(*)::int FROM institutions WHERE tenant_id = ${tenantId}) AS institutions`;
  return r.rows[0];
}

// Durable lifecycle status for a tenant — readable cross-process (the worker's
// in-memory status isn't visible to the web process, so the status endpoint
// reads this). last_lifecycle_run_at + the most recent lifecycle audit rows.
async function lifecycleRunInfo(tenantId) {
  const t = await sql`SELECT last_lifecycle_run_at FROM tenants WHERE id = ${tenantId}`;
  const recent = await sql`
    SELECT entity_id, action, created_at FROM audit_log
    WHERE tenant_id = ${tenantId} AND action IN ('tenant.provisioned','institution.merged')
    ORDER BY created_at DESC LIMIT 10`;
  return { lastRunAt: t.rows[0]?.last_lifecycle_run_at || null, recentActions: recent.rows };
}

module.exports = {
  STALE_DAYS, staleOrcids, staleCount, stampAuthorSynced,
  markTenantLifecycleRun, nextEligibleTenant, tenantCounts, lifecycleRunInfo,
};

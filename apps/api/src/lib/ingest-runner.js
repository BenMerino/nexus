const { ingestResolved } = require("./roster-ingest");

// Background paper-ingest runner. When a roster import adds ORCID-linked
// academics to a tenant, their publications should be pulled from OpenAlex
// without blocking the import request (ingest of a full roster takes many
// minutes). This runs the ingest in-process, after the response is sent, so
// it executes INSIDE the deployed app where the DB and outbound network are
// reachable — no manual `railway run` needed.
//
// Concurrency: a per-tenant lock prevents two overlapping imports from
// kicking off duplicate ingest loops for the same tenant. Idempotent anyway
// (ingestResolved skips DOIs already in the corpus), but the lock avoids
// wasted API calls.

const running = new Set(); // tenantIds with an ingest in flight
const BATCH = 10;

// Fire-and-forget: start a background ingest for the tenant if one isn't
// already running. Returns immediately. Errors are logged, never thrown.
function startTenantIngest(tenantId, label) {
  if (running.has(tenantId)) {
    console.log(`[ingest-runner] tenant ${tenantId} already ingesting; skip`);
    return { started: false, reason: "already-running" };
  }
  running.add(tenantId);
  // run on the next tick so the caller can respond first
  setImmediate(() => runLoop(tenantId, label || `auto-ingest:tenant-${tenantId}`));
  return { started: true };
}

async function runLoop(tenantId, label) {
  const t0 = Date.now();
  let offset = 0;
  const totals = { imported: 0, skipped: 0, errors: 0, processed: 0 };
  console.log(`[ingest-runner] start tenant ${tenantId}`);
  try {
    for (;;) {
      const r = await ingestResolved(tenantId, label, BATCH, offset);
      totals.imported += r.imported;
      totals.skipped += r.skipped;
      totals.errors += r.errors.length;
      totals.processed += r.processed;
      console.log(
        `[ingest-runner] tenant ${tenantId} | ${offset}-${r.nextOffset}/${r.total}`
        + ` | +${r.imported} imported (total ${totals.imported}), ${r.errors.length} err`);
      if (r.done) break;
      offset = r.nextOffset;
    }
    const mins = ((Date.now() - t0) / 60000).toFixed(1);
    console.log(`[ingest-runner] DONE tenant ${tenantId} in ${mins}min —`
      + ` processed=${totals.processed} imported=${totals.imported} already=${totals.skipped} errors=${totals.errors}`);
  } catch (err) {
    console.error(`[ingest-runner] tenant ${tenantId} fatal:`, err.message);
  } finally {
    running.delete(tenantId);
  }
}

module.exports = { startTenantIngest };

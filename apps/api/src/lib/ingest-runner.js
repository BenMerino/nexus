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

// Per-tenant live status, so the roster UI can show an indicator + progress.
// state: "running" | "done" | "error" | (absent = never run this process).
const status = new Map(); // tenantId -> { state, total, processed, imported, errors, startedAt, finishedAt }
const BATCH = 10;

function isRunning(tenantId) {
  return status.get(tenantId)?.state === "running";
}

function getTenantIngestStatus(tenantId) {
  return status.get(tenantId) || { state: "idle" };
}

// Fire-and-forget: start a background ingest for the tenant if one isn't
// already running. Returns immediately. Errors are logged, never thrown.
function startTenantIngest(tenantId, label) {
  if (isRunning(tenantId)) {
    console.log(`[ingest-runner] tenant ${tenantId} already ingesting; skip`);
    return { started: false, reason: "already-running" };
  }
  status.set(tenantId, {
    state: "running", total: null, processed: 0, imported: 0, errors: 0,
    startedAt: Date.now(), finishedAt: null,
  });
  // run on the next tick so the caller can respond first
  setImmediate(() => runLoop(tenantId, label || `auto-ingest:tenant-${tenantId}`));
  return { started: true };
}

async function runLoop(tenantId, label) {
  const t0 = Date.now();
  let offset = 0;
  const st = status.get(tenantId);
  console.log(`[ingest-runner] start tenant ${tenantId}`);
  try {
    for (;;) {
      const r = await ingestResolved(tenantId, label, BATCH, offset);
      st.total = r.total;
      st.processed = r.nextOffset;
      st.imported += r.imported;
      st.errors += r.errors.length;
      console.log(
        `[ingest-runner] tenant ${tenantId} | ${offset}-${r.nextOffset}/${r.total}`
        + ` | +${r.imported} imported (total ${st.imported}), ${r.errors.length} err`);
      if (r.done) break;
      offset = r.nextOffset;
    }
    st.state = "done";
    st.finishedAt = Date.now();
    const mins = ((Date.now() - t0) / 60000).toFixed(1);
    console.log(`[ingest-runner] DONE tenant ${tenantId} in ${mins}min —`
      + ` processed=${st.processed} imported=${st.imported} errors=${st.errors}`);
  } catch (err) {
    st.state = "error";
    st.error = err.message;
    st.finishedAt = Date.now();
    console.error(`[ingest-runner] tenant ${tenantId} fatal:`, err.message);
  }
}

module.exports = { startTenantIngest, getTenantIngestStatus };

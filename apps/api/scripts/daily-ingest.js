#!/usr/bin/env node
/*
 * Daily publication refresh — runs as a Railway cron service at 00:00 UTC.
 *
 * Walks every tenant and, for each academic that has an ORCID, pulls their
 * works from OpenAlex and stores any DOI not already in the corpus. Per-academic
 * the behavior is: new papers -> add; nothing new -> skip and move on. Safe to
 * run daily because ingestResolved() is idempotent (existing DOIs are skipped).
 *
 * Schedule (railway.json on the cron service): cron "0 0 * * *", which Railway
 * interprets in UTC. The service shares the project's DATABASE_URL, so it runs
 * inside Railway's private network where the DB + outbound APIs are reachable.
 */

const { listTenants } = require("../src/lib/db-users");
const { ingestResolved } = require("../src/lib/roster-ingest");

const BATCH = 10;

async function ingestTenant(tenantId) {
  let offset = 0;
  const totals = { processed: 0, imported: 0, skipped: 0, errors: 0 };
  for (;;) {
    const r = await ingestResolved(tenantId, `daily-ingest:${new Date().toISOString().slice(0, 10)}`, BATCH, offset);
    totals.processed += r.processed;
    totals.imported += r.imported;
    totals.skipped += r.skipped;
    totals.errors += r.errors.length;
    if (r.done) break;
    offset = r.nextOffset;
  }
  return totals;
}

(async () => {
  const t0 = Date.now();
  console.log(`[daily-ingest] start ${new Date().toISOString()}`);
  let tenants;
  try {
    tenants = await listTenants();
  } catch (err) {
    console.error("[daily-ingest] could not list tenants:", err.message);
    process.exit(1);
  }

  const grand = { processed: 0, imported: 0, skipped: 0, errors: 0 };
  for (const t of tenants) {
    try {
      const r = await ingestTenant(t.id);
      grand.processed += r.processed; grand.imported += r.imported;
      grand.skipped += r.skipped; grand.errors += r.errors;
      console.log(`[daily-ingest] tenant ${t.id} (${t.name || ""}) — `
        + `academics=${r.processed} new-papers=${r.imported} already=${r.skipped} errors=${r.errors}`);
    } catch (err) {
      console.error(`[daily-ingest] tenant ${t.id} failed:`, err.message);
    }
  }

  const mins = ((Date.now() - t0) / 60000).toFixed(1);
  console.log(`[daily-ingest] DONE in ${mins}min — tenants=${tenants.length} `
    + `new-papers=${grand.imported} already=${grand.skipped} errors=${grand.errors}`);
  process.exit(0);
})().catch((err) => { console.error("[daily-ingest] fatal:", err); process.exit(1); });

#!/usr/bin/env node
/*
 * One-shot: ingest publications for every ORCID-linked academic in a tenant.
 *
 * Drives ingestResolved() in batches until done, logging progress. Each batch
 * pulls each academic's works from OpenAlex and stores any DOI new to the
 * corpus (fetching full metadata across the four scholarly APIs). This is a
 * heavy, long-running job — run it in the Railway runtime where DATABASE_URL
 * and outbound network are available:
 *
 *   railway run --service Nexus -- node apps/api/scripts/ingest-roster-papers.js
 *
 * Optional args: TENANT_ID (default 1), BATCH (default 10).
 * Idempotent: DOIs already in doi_records are skipped, so re-running is safe.
 */

const { ingestResolved } = require("../src/lib/roster-ingest");

const TENANT_ID = parseInt(process.env.TENANT_ID || process.argv[2] || "1", 10);
const BATCH = parseInt(process.env.BATCH || process.argv[3] || "10", 10);
const UPLOADER = "ingest-roster-papers:script";

(async () => {
  const t0 = Date.now();
  let offset = 0;
  const totals = { batches: 0, processed: 0, doisSeen: 0, imported: 0, skipped: 0, errors: 0 };

  for (;;) {
    const r = await ingestResolved(TENANT_ID, UPLOADER, BATCH, offset);
    totals.batches++;
    totals.processed += r.processed;
    totals.doisSeen += r.doisSeen;
    totals.imported += r.imported;
    totals.skipped += r.skipped;
    totals.errors += r.errors.length;

    console.log(
      `[ingest] batch ${totals.batches} | academics ${offset}-${r.nextOffset}/${r.total}`
      + ` | +${r.imported} imported, ${r.skipped} already, ${r.errors.length} errors`
      + ` | running total imported=${totals.imported}`);
    for (const e of r.errors.slice(0, 5)) {
      console.warn(`  err: ${e.doi || e.orcid} -> ${e.error}`);
    }

    if (r.done) break;
    offset = r.nextOffset;
  }

  const mins = ((Date.now() - t0) / 60000).toFixed(1);
  console.log(`\n[ingest] DONE in ${mins} min — tenant ${TENANT_ID}`);
  console.log(`[ingest] academics processed=${totals.processed}, DOIs seen=${totals.doisSeen},`
    + ` imported=${totals.imported}, already-in-db=${totals.skipped}, errors=${totals.errors}`);
  process.exit(0);
})().catch((e) => { console.error("[ingest] fatal:", e); process.exit(1); });

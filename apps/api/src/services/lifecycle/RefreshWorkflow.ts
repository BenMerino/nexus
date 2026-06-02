/* ── RefreshWorkflow ───────────────────────────────────────────
 * Keep-fresh: pull NEW OpenAlex works for a tenant's stale/never-synced ORCIDs
 * and store them through the governed IngestionWorkflow (via fetchAndStore). A
 * Workflow — it orchestrates the per-DOI governed write and stamps freshness.
 *
 * Incremental by design: each ORCID is pulled with `since = its last_synced_at`
 * (OpenAlex from_created_date — "what was indexed since I last looked", catching
 * late-indexed old papers); a never-synced author (last_synced_at NULL) gets a
 * full walk. After pulling, the author is stamped synced so the next scan skips
 * it until it goes stale again. Idempotent: DOIs already in the corpus are
 * skipped. Bounded by maxOrcids so one tick can't run unboundedly.
 * ──────────────────────────────────────────────────────────── */

import type { ActorContext } from "../../substrate/actor";
const { sql } = require("../../lib/sql");
const { insertSubmission } = require("../../lib/db");
const { fetchAndStore } = require("../../lib/store");
const { doisForOrcid } = require("../../lib/roster-ingest");
const lifecycle = require("../../lib/db-lifecycle");

export interface RefreshResult {
  tenantId: number; orcidsProcessed: number; imported: number; skipped: number;
  errors: Array<{ orcid?: string; doi?: string; error: string }>;
}

class RefreshWorkflow {
  async refresh(ctx: ActorContext, opts: { maxOrcids?: number } = {}): Promise<RefreshResult> {
    const tenantId = ctx.tenantId;
    const stale = await lifecycle.staleOrcids(tenantId, opts.maxOrcids ?? 50);
    const result: RefreshResult = { tenantId, orcidsProcessed: 0, imported: 0, skipped: 0, errors: [] };

    for (const { orcid, last_synced_at } of stale) {
      result.orcidsProcessed++;
      let dois: string[];
      try {
        // last_synced_at NULL ⇒ undefined ⇒ full walk; else incremental.
        dois = await doisForOrcid(orcid, last_synced_at ? new Date(last_synced_at).toISOString() : null);
      } catch (err: any) {
        result.errors.push({ orcid, error: err.message });
        continue;
      }
      for (const doi of dois) {
        const exists = await sql`SELECT 1 FROM doi_records WHERE doi = ${doi} LIMIT 1`;
        if (exists.rows[0]) { result.skipped++; continue; }
        try {
          const subId = await insertSubmission(doi, `lifecycle-refresh:${ctx.userId}`);
          await fetchAndStore(doi, subId);
          result.imported++;
        } catch (err: any) {
          result.errors.push({ doi, error: err.message });
        }
      }
      // Stamp synced regardless of import count — we DID look; freshness is about
      // "when did we last check", not "did we find anything".
      await lifecycle.stampAuthorSynced(tenantId, orcid, null);
    }
    return result;
  }
}

export const refreshWorkflow = new RefreshWorkflow();

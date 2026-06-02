/* ── PublicationGovernor ───────────────────────────────────────
 * Sole writer for the publication aggregate: the paper row (`publications`)
 * plus all of its edges — authorship, published_in, affiliation,
 * affiliated_with, and the venue rows + indexation flags those edges imply
 * (DGA_DESIGN §15). This is the write that ingestion used to do inline in
 * store.js / store-openalex.js, OUTSIDE any governor.
 *
 * `upsert` wraps the existing repos unchanged — `upsertRecord` (the paper row)
 * + `syncRecordEntities` (which internally chains syncVenues → venue flags →
 * affiliations). A pure wrapper: the entity writes are identical to the old
 * inline path (see PublicationLogic). Emits `publication.upserted` AFTER the
 * write. Called only by IngestionWorkflow (the one governor-to-governor seam).
 *
 * withTenant arrives in the RLS phase; for now the repos use the plain `sql`
 * pool, like ProjectGovernor and AuthorGovernor.
 * ──────────────────────────────────────────────────────────── */

import { BaseGovernor } from "../BaseGovernor";
import type { ActorContext } from "../../substrate/actor";
import { upsertArgs, canonTags, type NormalizedRecord } from "./PublicationLogic";
const { upsertRecord, getRecordByDoi } = require("../../lib/db");
const { syncRecordEntities } = require("../../lib/db-entities");
const { sql } = require("../../lib/sql");

export interface UpsertPublicationInput {
  submissionId: number;
  record: NormalizedRecord;
  sources: unknown;
}

class PublicationGovernor extends BaseGovernor {
  /** Upsert a paper + sync its entity edges. Returns the publications.id.
   *  Idempotent (re-ingest replaces edges); behavior-neutral wrapper of the
   *  prior inline store path. */
  async upsert(ctx: ActorContext, input: UpsertPublicationInput): Promise<number> {
    const { submissionId, record, sources } = input;
    if (!record?.doi) throw new Error("record.doi required");

    await upsertRecord(...upsertArgs(submissionId, record, sources));
    const dbRecord = await getRecordByDoi(record.doi);

    // Tenant for the entity sync: the stored row's tenant (matches the old
    // inline `SELECT tenant_id … ?? 1`), so the wrapper stays byte-for-byte.
    const tRow = await sql`SELECT tenant_id FROM publications WHERE id = ${dbRecord.id}`;
    const tenantId = tRow.rows[0]?.tenant_id ?? 1;
    await syncRecordEntities(dbRecord.id, tenantId, record, canonTags(record));

    this.emitEvent("publication.upserted", {
      tenantId, publicationId: dbRecord.id, doi: record.doi,
      actorUserId: ctx.userId, actorKind: ctx.actorKind,
    });
    await this.logToLedger(tenantId, `publication:${dbRecord.id}`, "publication.upserted", ctx.userId);
    return dbRecord.id;
  }
}

export const publicationGovernor = new PublicationGovernor();

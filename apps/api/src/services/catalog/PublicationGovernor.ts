/* ── PublicationGovernor ───────────────────────────────────────
 * Sole writer for the publication aggregate: the paper row (`publications`)
 * plus ITS EDGES — authorship, published_in, affiliation, affiliated_with, and
 * the per-paper is_repository flag (DGA_DESIGN §15). It does NOT write the
 * authors/venues/institutions tables — those are owned by their own governors
 * (Author/Venue/Institution), upserted as workflow steps BEFORE the edges are
 * linked here. linkEdges connects existing entities by natural key (orcid /
 * name_key / ror); see PLAN-ingest-sole-writer-split.
 *
 * Two methods so the IngestionWorkflow can order entity-upserts between them:
 *   upsertRow  → the paper row, returns {id, tenantId}.
 *   linkEdges  → (re)link the edge tables; emits `publication.upserted` after.
 * withTenant arrives in the RLS phase; repos use the plain `sql` pool for now.
 * ──────────────────────────────────────────────────────────── */

import { BaseGovernor } from "../BaseGovernor";
import type { ActorContext } from "../../substrate/actor";
import { upsertArgs, type NormalizedRecord } from "./PublicationLogic";
const { upsertRecord, getRecordByDoi } = require("../../lib/db");
const { linkRecordEdges } = require("../../lib/db-entities");
const { sql } = require("../../lib/sql");

export interface UpsertPublicationInput {
  submissionId: number;
  record: NormalizedRecord;
  sources: unknown;
}

class PublicationGovernor extends BaseGovernor {
  /** Upsert the paper row. Returns its id + the stored row's tenant (matches the
   *  old inline `?? 1` resolution). No edges yet — the workflow upserts the
   *  entity tables, then calls linkEdges. */
  async upsertRow(_ctx: ActorContext, input: UpsertPublicationInput): Promise<{ id: number; tenantId: number }> {
    const { submissionId, record, sources } = input;
    if (!record?.doi) throw new Error("record.doi required");
    await upsertRecord(...upsertArgs(submissionId, record, sources));
    const dbRecord = await getRecordByDoi(record.doi);
    const tRow = await sql`SELECT tenant_id FROM publications WHERE id = ${dbRecord.id}`;
    return { id: dbRecord.id, tenantId: tRow.rows[0]?.tenant_id ?? 1 };
  }

  /** (Re)link this paper's edges to entities already upserted by their
   *  governors. Emits `publication.upserted` after the edges commit. */
  async linkEdges(ctx: ActorContext, recordId: number, tenantId: number,
                  record: NormalizedRecord, tags: Array<Record<string, unknown>>): Promise<void> {
    await linkRecordEdges(recordId, tenantId, record, tags);
    this.emitEvent("publication.upserted", {
      tenantId, publicationId: recordId, doi: record.doi,
      actorUserId: ctx.userId, actorKind: ctx.actorKind,
    });
    await this.logToLedger(tenantId, `publication:${recordId}`, "publication.upserted", ctx.userId);
  }
}

export const publicationGovernor = new PublicationGovernor();

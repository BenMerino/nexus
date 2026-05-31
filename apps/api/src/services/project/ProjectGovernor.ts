/* ── ProjectGovernor ───────────────────────────────────────────
 * Sole writer for the project aggregate (projects + project_investigators).
 * First migrated governor — standalone admin CRUD, no pipeline entanglement.
 *
 * Wraps the existing `db-projects` repo (still on the legacy `sql` pool;
 * it moves to withTenant in the RLS phase). The governor adds the DGA
 * contract on top: validate → write → emit `project.*` AFTER the write →
 * audit-log. Reads pass through unchanged (a ProjectResolver formalizes
 * them later). Route URL /api/projects is unchanged; the handler delegates.
 * ──────────────────────────────────────────────────────────── */

import { BaseGovernor } from "../BaseGovernor";
import type { ActorContext } from "../../substrate/actor";
import type { CreateProjectInput, UpdateProjectInput } from "./ProjectTypes";
import {
  listProjects, getProject, createProject, updateProject, deleteProject,
} from "../../lib/db-projects";

class ProjectGovernor extends BaseGovernor {
  // ── reads (pass-through; scope-checked by the handler gate) ──
  list(tenantId: number) {
    return listProjects(tenantId);
  }
  get(id: number, tenantId: number) {
    return getProject(id, tenantId);
  }

  // ── writes (validate → repo → event-after-write → ledger) ──
  async create(ctx: ActorContext, input: CreateProjectInput): Promise<number> {
    if (!input.fields?.titulo) throw new Error("titulo required");
    const id = await createProject(ctx.tenantId, input.fields, input.investigators, ctx.userId);
    this.emitEvent("project.created", {
      tenantId: ctx.tenantId, projectId: id, actorUserId: ctx.userId, actorKind: ctx.actorKind,
    });
    await this.logToLedger(ctx.tenantId, `project:${id}`, "project.created", ctx.userId);
    return id;
  }

  async update(ctx: ActorContext, input: UpdateProjectInput): Promise<boolean> {
    if (!input.id) throw new Error("id required");
    const ok = await updateProject(input.id, ctx.tenantId, input.fields, input.investigators);
    if (!ok) return false;
    this.emitEvent("project.updated", {
      tenantId: ctx.tenantId, projectId: input.id, actorUserId: ctx.userId, actorKind: ctx.actorKind,
    });
    await this.logToLedger(ctx.tenantId, `project:${input.id}`, "project.updated", ctx.userId);
    return true;
  }

  async remove(ctx: ActorContext, id: number): Promise<boolean> {
    const ok = await deleteProject(id, ctx.tenantId);
    if (!ok) return false;
    this.emitEvent("project.deleted", {
      tenantId: ctx.tenantId, projectId: id, actorUserId: ctx.userId, actorKind: ctx.actorKind,
    });
    await this.logToLedger(ctx.tenantId, `project:${id}`, "project.deleted", ctx.userId);
    return true;
  }
}

export const projectGovernor = new ProjectGovernor();

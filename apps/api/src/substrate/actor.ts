/* ── ActorContext (substrate) ──────────────────────────────────
 * The identity threaded through every Governor write — who is acting,
 * in which tenant, with what authority. Substrate, NOT a DGA domain:
 * the DGA *consumes* this (it's the `ctx` parameter on governor methods)
 * but never governs it. Built from the existing scope (`lib/scope.js`)
 * by `actorContext(req)` — see Phase 2. No parallel auth.
 *
 * Mirrors the scope shape: requireScope returns
 * { tenantId, orcid, ror, role, userId, username }.
 * ──────────────────────────────────────────────────────────── */

/** Who is acting: a logged-in human, a background job, or the system. */
export type ActorKind = "user" | "system" | "job";

export interface ActorContext {
  /** Integer tenant id — the scope every governor write runs inside
   *  (set as the `app.tenant_id` GUC by `withTenant`). */
  tenantId: number;
  /** The acting principal's user id (string). */
  userId: string;
  /** Human-readable label for audit/ledger rows. */
  displayName?: string;
  actorKind: ActorKind;
  /** Authorization role (superadmin/admin/tenant_admin/director/academic). */
  role?: string;
  /** The actor's ORCID, when they're a researcher acting on their own slice. */
  orcid?: string | null;
  /** The actor's home-institution ROR (the tenant's ror_id). Read by
   *  scope-narrowed reads — e.g. node-detail renders a researcher's OWN
   *  institution differently. Part of the scope→ctx seam. */
  ror?: string | null;
  /** Effective timestamp for the write (ISO). Absent ⇒ "now". Lets
   *  backfills/replays stamp historical writes deterministically. */
  asOf?: string;
}

/** A non-human actor for cron/backfill/seed paths. */
export function systemActor(tenantId: number, label = "system"): ActorContext {
  return { tenantId, userId: label, displayName: label, actorKind: "system" };
}

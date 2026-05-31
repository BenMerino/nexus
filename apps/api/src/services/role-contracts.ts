/* ── DGA Role Contracts ────────────────────────────────────────
 * The 6 roles of the Deterministic Governor Architecture and what
 * each may do. Port of Zincro's role-contracts. DOCS-ONLY at runtime:
 * not enforced by code — upheld by review against this table and
 * .claude/rules/governor-patterns.md. The map is exported so a future
 * reflection/admin view can render it, and so the role vocabulary has
 * one canonical source.
 * ──────────────────────────────────────────────────────────── */

export type Role =
  | "Governor"
  | "Validator"
  | "Resolver"
  | "Composer"
  | "Workflow"
  | "Dispatcher";

export interface RoleContract {
  role: Role;
  description: string;
  canWrite: boolean;
  canEmitEvents: boolean;
  canCallOtherGovernors: boolean;
  canHaveSideEffects: boolean;
}

export const ROLE_CONTRACTS: Record<Role, RoleContract> = {
  Governor: {
    role: "Governor",
    description:
      "Owns one aggregate. CRUD + emits events. The only role that writes. Extends BaseGovernor.",
    canWrite: true,
    canEmitEvents: true,
    canCallOtherGovernors: false,
    canHaveSideEffects: false,
  },
  Validator: {
    role: "Validator",
    description:
      "Pure decision logic. Reads any Governor. No writes, no events.",
    canWrite: false,
    canEmitEvents: false,
    canCallOtherGovernors: false,
    canHaveSideEffects: false,
  },
  Resolver: {
    role: "Resolver",
    description:
      "Stateless compound reads. May cache, invalidating on events. No writes.",
    canWrite: false,
    canEmitEvents: false,
    canCallOtherGovernors: false,
    canHaveSideEffects: false,
  },
  Composer: {
    role: "Composer",
    description:
      "Assembles UI directives (GraphDirective) from reads. No writes.",
    canWrite: false,
    canEmitEvents: false,
    canCallOtherGovernors: false,
    canHaveSideEffects: false,
  },
  Workflow: {
    role: "Workflow",
    description:
      "Orchestrates a multi-Governor sequence. The only role that calls Governors directly.",
    canWrite: false,
    canEmitEvents: false,
    canCallOtherGovernors: true,
    canHaveSideEffects: false,
  },
  Dispatcher: {
    role: "Dispatcher",
    description:
      "Delivers to / fetches from external systems (scholarly APIs, ROR, storage). Side effects expected.",
    canWrite: false,
    canEmitEvents: false,
    canCallOtherGovernors: false,
    canHaveSideEffects: true,
  },
};

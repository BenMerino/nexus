/* ── ActionManifest ────────────────────────────────────────────
 * Declarative descriptor of a Governor WRITE operation, exposed as an
 * AI/automation tool. Each domain's `{Domain}Actions.ts` exports
 * `actions: ActionManifest[]`; the scanner auto-discovers them at boot.
 * Port of Zincro's action.types. The AI-chat surface is future; the
 * registry is built now (empty) so the wiring exists.
 * ──────────────────────────────────────────────────────────── */

import type { ActorContext } from "../../substrate/actor";

export interface ActionManifest {
  /** Unique tool name (e.g. `publication.upsert`). */
  name: string;
  /** Intent description for an LLM router / catalog. */
  description: string;
  /** Governor/domain dependencies (e.g. ['publication']). */
  requires: string[];
  /** JSON Schema for the input payload. */
  inputSchema: Record<string, unknown>;
  /** Show a confirmation prompt before executing. */
  requiresConfirmation: boolean;
  /** RBAC gate (e.g. `write:publications`). */
  rbacPermission: string;
  /** Run the action with the acting context. Returns a result summary. */
  executeWithCtx: (input: any, ctx: ActorContext) => Promise<unknown>;
}

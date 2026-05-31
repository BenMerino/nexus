/* ── ResolverManifest ──────────────────────────────────────────
 * Declarative descriptor of a READ operation (Resolver/Composer),
 * exposed as an AI/automation tool. Each domain's
 * `{Domain}ResolverTools.ts` exports `resolverTools: ResolverManifest[]`.
 * Port of Zincro's resolver.types, plus the chartable/tableable flags
 * the Architect composer keys off. Registry built now (empty).
 * ──────────────────────────────────────────────────────────── */

import type { ActorContext } from "../../substrate/actor";

export interface ResolverManifest {
  name: string;
  description: string;
  requires: string[];
  inputSchema: Record<string, unknown>;
  rbacPermission: string;
  executeWithCtx: (input: any, ctx: ActorContext) => Promise<unknown>;
  /** Eligible for the Architect chart composer (result is a series). */
  chartable?: boolean;
  /** Eligible for table rendering (result is a row set). */
  tableable?: boolean;
}

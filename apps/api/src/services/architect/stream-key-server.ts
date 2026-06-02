/* ── Stream Key (server) ────────────────────────────────────
 * Canonical query → stable string key. MUST stay byte-identical to the
 * client's `apps/web/architect/stream-key.ts` (sorted JSON, undefined
 * dropped) so a client subscribes with the same handle the server emits.
 * The single server-side copy; both recompose-registry (stamping) and
 * StreamRegistry (subscription index) import it.
 * ──────────────────────────────────────────────────────────── */

export function streamKeyOf(query: object): string {
  const q = query as Record<string, unknown>;
  const keys = Object.keys(q).filter((k) => q[k] !== undefined).sort();
  const sorted: Record<string, unknown> = {};
  for (const k of keys) sorted[k] = q[k];
  return JSON.stringify(sorted);
}

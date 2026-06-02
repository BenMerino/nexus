import type { BaseQuery } from './replayable-directive.js';

/* ── Recompose client ───────────────────────────────────────
 * Thin fetch wrapper the directive controller uses to ask the
 * server for a fresh directive given a (mutated) query. Nexus has
 * no telemetry module — Zincro's controller posts via `apiPost`;
 * here we POST plainly to the existing `/api/architect/recompose`
 * endpoint (same shape `tenant-replay-chart.tsx` already used).
 *
 * Throws on non-2xx so the controller surfaces an error hint.
 * ──────────────────────────────────────────────────────────── */

export async function recomposePost<TDirective>(query: BaseQuery): Promise<TDirective> {
    const res = await fetch('/api/architect/recompose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
    });
    if (!res.ok) {
        throw new Error(`recompose failed (${res.status})`);
    }
    return res.json() as Promise<TDirective>;
}

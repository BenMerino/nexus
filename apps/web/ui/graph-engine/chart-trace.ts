/* ── chart-trace ────────────────────────────────────────────
 * Gated console diagnostic for the graph-engine's data + render flow.
 * Ported from Zincro's `chartDebug` pattern (apps/admin-web/src/debug/
 * chartDebug.ts): off by default, dormant in production, lit up per-scope
 * from the browser console with NO code edits:
 *
 *   localStorage.setItem('nexus:debug', 'charts')        // enable
 *   localStorage.setItem('nexus:debug', 'charts,anim')   // multiple scopes
 *   localStorage.removeItem('nexus:debug')               // disable
 *
 * Every call short-circuits before any serialization when the flag is
 * absent, so production never pays for it. Console-only — no overlay, no
 * fetch patching (Zincro deliberately keeps it to console + React DevTools).
 * ──────────────────────────────────────────────────────────── */

const FLAG_KEY = 'nexus:debug';

/** Is the given trace scope enabled via localStorage['nexus:debug']? */
function enabled(scope: string): boolean {
    if (typeof window === 'undefined') return false;
    try {
        const raw = window.localStorage.getItem(FLAG_KEY);
        if (!raw) return false;
        return raw.split(',').map(s => s.trim()).includes(scope);
    } catch {
        return false;
    }
}

/** Emit a structured, scoped debug entry. Wrap call sites in this so the
 *  flag controls every log site at once. `scope` defaults to 'charts'. */
export function chartTrace(tag: string, payload?: unknown, scope: string = 'charts'): void {
    if (!enabled(scope)) return;
    // eslint-disable-next-line no-console
    if (payload === undefined) console.debug(`[nexus:${scope}] ${tag}`);
    else console.debug(`[nexus:${scope}] ${tag}`, payload);
}

/** True when a scope is enabled — gate EXPENSIVE serialization at the call
 *  site. Most callers should just call `chartTrace(...)` and let it
 *  short-circuit internally. */
export function isChartTrace(scope: string = 'charts'): boolean {
    return enabled(scope);
}

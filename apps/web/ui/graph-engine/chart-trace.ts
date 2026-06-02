/* ── chart-trace (temporary diagnostic) ─────────────────────
 * Disposable instrumentation to pinpoint WHY a stacked-bar legend toggle
 * "reloads" instead of tweening. The engine code is byte-identical to
 * Zincro, so the reload must be a React REMOUNT (which discards the
 * animation refs and re-runs useChartAnimation's useState initializer =
 * snap, no tween) or an activeSet RE-SEED. This records the telltales so a
 * single toggle reveals the cause — no DevTools archaeology needed.
 *
 * Enable with `?charttrace=1` on the URL. Off → every probe is a no-op and
 * nothing renders. REMOVE this file + its probes once the cause is found.
 * ──────────────────────────────────────────────────────────── */

export interface TraceEntry { t: number; tag: string; detail: string }

const RING_MAX = 60;
const ring: TraceEntry[] = [];
let enabled: boolean | null = null;
let seq = 0;

export function traceOn(): boolean {
    if (enabled === null) {
        enabled = typeof window !== 'undefined' && /[?&]charttrace=1\b/.test(window.location.search);
    }
    return enabled;
}

/** Monotonic-ish ms since first call — avoids Date.now noise, good enough
 *  to order events within a single toggle. */
function now(): number {
    return typeof performance !== 'undefined' ? Math.round(performance.now()) : ++seq;
}

export function traceEvent(tag: string, detail: string = ''): void {
    if (!traceOn()) return;
    ring.push({ t: now(), tag, detail });
    if (ring.length > RING_MAX) ring.shift();
    // Also to console so it's capturable even without the overlay.
    // eslint-disable-next-line no-console
    console.log(`[charttrace] ${tag}${detail ? ' · ' + detail : ''}`);
    notify();
}

/** A fresh monotonic id — probes use it to tag a component instance so a
 *  remount (new id appearing) is visible vs a re-render (same id). */
export function traceMountId(): number {
    return ++seq;
}

/** One-time fetch wrapper: logs any /api/* request so we see if a toggle
 *  triggers a data fetch it shouldn't. Idempotent; no-op when trace off. */
let fetchPatched = false;
export function traceInstallFetchProbe(): void {
    if (!traceOn() || fetchPatched || typeof window === 'undefined' || !window.fetch) return;
    fetchPatched = true;
    const orig = window.fetch.bind(window);
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
        if (url && url.includes('/api/')) traceEvent('FETCH', `${init?.method ?? 'GET'} ${url.replace(/^https?:\/\/[^/]+/, '')}`);
        return orig(input as RequestInfo, init);
    };
    // WebSocket too (the stream bridge).
    const OrigWS = window.WebSocket;
    if (OrigWS) {
        window.WebSocket = function (url: string | URL, protocols?: string | string[]) {
            traceEvent('WS open', String(url).replace(/^wss?:\/\/[^/]+/, ''));
            return new OrigWS(url, protocols);
        } as unknown as typeof WebSocket;
        window.WebSocket.prototype = OrigWS.prototype;
    }
}

const listeners = new Set<() => void>();
function notify(): void { for (const l of listeners) l(); }
export function traceSubscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
}
export function traceSnapshot(): TraceEntry[] {
    return ring.slice();
}
export function traceClear(): void {
    ring.length = 0;
    notify();
}

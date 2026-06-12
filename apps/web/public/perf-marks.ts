/* ── Client load-timing beacon ──────────────────────────────
 * Records real-browser phase timings for the public tenant page and ships
 * them to POST /api/public/:slug/perf. The page calls `perfMark(phase)` at
 * each milestone (shell painted, chrome fetched, each chart filled); on load
 * settle we flush the deltas via sendBeacon (survives unload, non-blocking).
 *
 * Why this exists: the page feels ~10s slow for real users but every endpoint
 * measures fast from the dev network — the bottleneck is in the client's
 * render/fetch sequence, only visible from the client. Kept as standing
 * instrumentation. Zero deps; no-op if performance/sendBeacon are absent.
 * ──────────────────────────────────────────────────────────── */

interface Phase { phase: string; ms: number }

const navId = `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
const t0 = typeof performance !== "undefined" ? performance.now() : 0;
const phases: Phase[] = [];
let flushed = false;

/** Stamp a phase with ms-since-navigation-start. Idempotent per phase label
 *  (first mark wins — we want time-to-first, not last). */
export function perfMark(phase: string): void {
  if (typeof performance === "undefined") return;
  if (phases.some((p) => p.phase === phase)) return;
  phases.push({ phase, ms: performance.now() - t0 });
}

/** Flush to the beacon endpoint. Called on load-settle and pagehide; the
 *  first call wins. Best-effort — failure never touches the page. */
export function perfFlush(slug: string): void {
  if (flushed || !slug || !phases.length) return;
  flushed = true;
  const body = JSON.stringify({ navId, phases });
  const url = `/api/public/${encodeURIComponent(slug)}/perf`;
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
    } else {
      fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
    }
  } catch {
    /* beacon is best-effort */
  }
}

/** Auto-flush once the page has settled (all charts had a chance to fill) and
 *  again on pagehide as a backstop. Call once with the slug after mount. */
export function perfAutoFlush(slug: string): void {
  if (typeof window === "undefined") return;
  // Settle window: charts fire their recompose after the chrome gate; 6s is a
  // generous ceiling that still captures the staggered fills we're hunting.
  window.setTimeout(() => perfFlush(slug), 6000);
  window.addEventListener("pagehide", () => perfFlush(slug), { once: true });
}

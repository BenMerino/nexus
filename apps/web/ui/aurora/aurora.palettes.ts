/* ── aurora palette ────────────────────────────────────────
 * Aurora is ONE variant now. Its colors are not a self-contained hue system —
 * they DERIVE from the day/night sun pipeline. The pipeline (public/sky/) writes
 * sky-driven tokens onto :root every minute: --accent + --chart-0..8 shift from
 * violet (night) → amber (golden hour) → blue (midday). Aurora's stops are just
 * those tokens as `var(--…)` strings; the shader resolves them live each frame
 * (resolveColor reads :root), so the button gradient tracks the sky like the
 * rest of the platform. No per-button sub-variant, no hardcoded hues. */

/** Aurora's gradient stops = sun-pipeline tokens (resolved live by the shader).
 *  Chosen to span the sky palette's lightness so the mesh has depth: accent +
 *  a light, mid and deep chart series. Falls back to the token's own fallback
 *  if the sky pipeline isn't mounted (e.g. SSR / no WebGPU). */
export function sunStops(): string[] {
    return [
        'var(--chart-2, #8ab4f0)',  // lightest sky stop
        'var(--accent, #4f46e5)',   // the sky hue itself (where the sun is)
        'var(--chart-3, #3a6ea5)',  // mid
        'var(--chart-6, #2a4d7a)',  // deepest
    ];
}

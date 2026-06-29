/* ── aurora palette ────────────────────────────────────────
 * Aurora is ONE variant, fed by the sun pipeline — NO loose colors of its own.
 * The pipeline (public/sky/sky-colors.ts) emits a hand-picked pair onto :root:
 * --sky-primary + --sky-companion (e.g. day = light blue + sunshine). Aurora is
 * just those two colors blended as the mesh — two real hues, no hue-fan, so it
 * never drifts to green. The shader resolves the tokens live each frame, so the
 * mesh tracks the sky. Falls back to a blue/amber pair if the pipeline is
 * unmounted (SSR / no sky-bg). */

/** Aurora's two stops = the pipeline's hand-picked pair tokens. */
export function sunStops(): string[] {
    return [
        'var(--sky-primary, hsl(210 72% 60%))',
        'var(--sky-companion, hsl(45 92% 62%))',
    ];
}

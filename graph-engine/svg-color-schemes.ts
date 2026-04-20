import type { ColorScheme } from '../../architect/graph-composer.types.js';

/* ── Color Scheme Resolution ─────────────────────────────────
 * Default palettes and series-color helpers for chart rendering.
 * ──────────────────────────────────────────────────────────── */

/* Series palette built from Nexus design tokens (public/shared.css :root).
 * Order is tuned for legibility on dark surfaces — alternates hue family
 * (warm/cool/green/magenta) so adjacent stack segments stay distinct. */
const CTX_S = [
    'var(--primary)',     // warm gold
    'var(--secondary)',   // blue
    'var(--journal)',     // magenta
    'var(--ok)',          // green
    'var(--accent-dim)',  // muted gold
    'var(--warn)',        // gold (slightly cooler than primary)
    'var(--paper)',       // near-neutral
    'var(--err)',         // red — last so it only appears in busy stacks
];
const N = (p: string, s?: string[]): ColorScheme => ({ sentiment: 'neutral', primary: p, fill: p, seriesColors: s });
const PRIMARY_G: ColorScheme = { sentiment: 'neutral', primary: 'var(--primary)', fill: 'var(--primary)', gradient: ['var(--primary)', 'var(--accent-dim)'] };
const OK: ColorScheme = { sentiment: 'positive', primary: 'var(--ok)', fill: 'var(--ok)' };
const TYPE_SCHEME: Record<string, ColorScheme> = {
    heatmap: { sentiment: 'neutral', primary: 'var(--primary)', fill: 'var(--primary)', gradient: ['var(--bg-elev)', 'var(--accent-dim)', 'var(--primary)'] },
    bubble: N(CTX_S[0], CTX_S), scatter: N(CTX_S[0], CTX_S),
    bar: PRIMARY_G, line: PRIMARY_G, area: PRIMARY_G,
    'stacked-bar': N(CTX_S[0], CTX_S),
    pie: N(CTX_S[0], CTX_S), donut: N(CTX_S[0], CTX_S), funnel: N(CTX_S[0], CTX_S), treemap: N(CTX_S[0], CTX_S),
    radar: N(CTX_S[0], CTX_S), gauge: OK, 'progress-ring': OK,
};
const DNA_FALLBACK: ColorScheme = { sentiment: 'neutral', primary: 'var(--primary)', fill: 'var(--primary)' };

export function cs(chart: { colorScheme?: ColorScheme; type?: string }): ColorScheme {
    return chart.colorScheme ?? (chart.type ? TYPE_SCHEME[chart.type] : undefined) ?? DNA_FALLBACK;
}

export const FALLBACK_SERIES = CTX_S;
export function seriesColor(scheme: ColorScheme, i: number): string {
    return scheme.seriesColors?.[i % (scheme.seriesColors?.length || 1)]
        ?? FALLBACK_SERIES[i % FALLBACK_SERIES.length];
}

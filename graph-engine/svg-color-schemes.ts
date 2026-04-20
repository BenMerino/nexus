import type { ColorScheme } from '../../architect/graph-composer.types.js';

/* ── Color Scheme Resolution ─────────────────────────────────
 * Default palettes and series-color helpers for chart rendering.
 * ──────────────────────────────────────────────────────────── */

const CTX_S = [
    'var(--chart-5, #06b6d4)', 'var(--chart-3, #8b5cf6)', 'var(--status-success, #10b981)',
    'var(--chart-4, #f59e0b)', 'var(--chart-6, #ec4899)', 'var(--chart-7, #14b8a6)',
    'var(--chart-8, #6366f1)', 'var(--status-info, #3b82f6)',
];
const N = (p: string, s?: string[]): ColorScheme => ({ sentiment: 'neutral', primary: p, fill: p, seriesColors: s });
const INFO_G: ColorScheme = { sentiment: 'neutral', primary: 'var(--status-info, #3b82f6)', fill: 'var(--status-info, #3b82f6)', gradient: ['#3b82f6', '#06b6d4'] };
const OK: ColorScheme = { sentiment: 'positive', primary: 'var(--status-success, #10b981)', fill: 'var(--status-success, #10b981)' };
const TYPE_SCHEME: Record<string, ColorScheme> = {
    heatmap: { sentiment: 'neutral', primary: CTX_S[0], fill: CTX_S[0], gradient: ['#6366f1', '#a855f7', '#ec4899', '#f97316'] },
    bubble: N(CTX_S[1], CTX_S), scatter: N(CTX_S[1], CTX_S),
    bar: INFO_G, line: INFO_G, area: INFO_G,
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

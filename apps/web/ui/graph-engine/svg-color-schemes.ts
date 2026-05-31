import type { ColorScheme } from '../../architect/graph-composer.types.js';

/* ── Color Scheme Resolution ─────────────────────────────────
 * Default palettes and series-color helpers for chart rendering.
 *
 * Multi-series palette references the design system's chart tokens
 * (--chart-1..8). Theme adaptation lives at the token layer:
 * theme.css overrides each --chart-N for :root.dark with a higher-L
 * oklch value so series stay legible on dark surfaces. Renderers never
 * need to know which theme is active.
 * ──────────────────────────────────────────────────────────── */

const SERIES_PALETTE = [
    'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)',
    'var(--chart-5)', 'var(--chart-6)', 'var(--chart-7)', 'var(--chart-8)',
];

/* ── Sequential Ramps (DNA-governed) ───────────────────────
 * 6 perceptually-uniform 5-stop ramps for continuous-color charts.
 * Triadic 120° hue spacing in oklch guarantees clean mixes — any pair
 * of ramps blended via color-mix lands on a third pure hue, no mud.
 * Tokens emitted from chartPalette.ramps in dna-defaults.css (light)
 * and dna-css-dark.ts (dark, inverted L curve).
 *
 * Use: gradient = RAMPS.azure  /  for bivariate later: mix two by name. */
const ramp = (name: string) => [1, 2, 3, 4, 5].map(i => `var(--ramp-${name}-${i})`);
export const RAMPS = {
    azure:   ramp('azure'),    // h=250 — default heatmap
    crimson: ramp('crimson'),  // h=10
    amber:   ramp('amber'),    // h=130
    violet:  ramp('violet'),   // h=310
    orange:  ramp('orange'),   // h=70
    teal:    ramp('teal'),     // h=190
} as const;
export type RampName = keyof typeof RAMPS;

/* Default single-series scheme for bar/line/area. `primary`/`fill` resolve
 * from the CHART palette (`--chart-0`), NOT `--status-info`. Charts must not
 * borrow the semantic-status palette: status colors carry UI meaning
 * (success/error/info) and are tuned for badges/alerts, so a chart
 * inheriting one couples chart appearance to an unrelated token — which is
 * exactly how the dark-mode washout leaked in. Sourcing from `--chart-0`
 * keeps every chart governed by the chart palette's light/dark formula. */
const INFO_G: ColorScheme = { sentiment: 'neutral', primary: 'var(--chart-0)', fill: 'var(--chart-0)', gradient: ['var(--chart-7)', 'var(--chart-5)'] };
const OK: ColorScheme = { sentiment: 'positive', primary: 'var(--status-success)', fill: 'var(--status-success)' };
const N = (): ColorScheme => ({ sentiment: 'neutral', primary: SERIES_PALETTE[0], fill: SERIES_PALETTE[0] });

const TYPE_SCHEME: Record<string, ColorScheme> = {
    heatmap: { sentiment: 'neutral', primary: SERIES_PALETTE[0], fill: SERIES_PALETTE[0], gradient: RAMPS.azure },
    bubble: N(), scatter: N(),
    bar: INFO_G, line: INFO_G, area: INFO_G,
    pie: N(), donut: N(), funnel: N(), treemap: N(),
    radar: N(),
    gauge: OK, 'progress-ring': OK,
};

const DNA_FALLBACK: ColorScheme = { sentiment: 'neutral', primary: 'var(--primary)', fill: 'var(--primary)' };

export function cs(chart: { colorScheme?: ColorScheme; type?: string }): ColorScheme {
    const typeScheme = chart.type ? TYPE_SCHEME[chart.type] : undefined;
    const explicit = chart.colorScheme;
    if (!explicit) return typeScheme ?? DNA_FALLBACK;
    // Merge: explicit takes precedence per-field, but type defaults fill in any
    // missing fields. So a server-side scheme that sets `primary`/`fill` but not
    // `gradient` still picks up the type's multi-hue ramp instead of leaving
    // renderers to a generic green→red fallback.
    return {
        ...(typeScheme ?? DNA_FALLBACK),
        ...explicit,
        gradient: explicit.gradient ?? typeScheme?.gradient,
        seriesColors: explicit.seriesColors ?? typeScheme?.seriesColors,
    };
}

/** Series-color resolver: explicit palette first, then themed palette. */
export function seriesColor(scheme: ColorScheme, i: number): string {
    const palette = (scheme.seriesColors && scheme.seriesColors.length > 0) ? scheme.seriesColors : SERIES_PALETTE;
    return palette[i % palette.length];
}

/** Category-IDENTITY color resolver: binds a color to the series KEY
 *  (e.g. "OpenAlex" → teal) rather than positional palette order, so a
 *  series keeps its color regardless of legend reorder or which siblings
 *  are toggled off. Falls back to positional `seriesColor` when the key
 *  isn't in `seriesColorMap`. The legend swatch AND every family route
 *  through this with the same key, so swatch and mark can't disagree. */
export function seriesColorFor(scheme: ColorScheme, key: string, i: number): string {
    return scheme.seriesColorMap?.[key] ?? seriesColor(scheme, i);
}

/** Returns the multi-series palette tokens. Theme-adapts at the CSS layer. */
export function getSeriesPalette(): string[] {
    return SERIES_PALETTE;
}

/**
 * Per-tenant accent THEMES — the white-label override layer.
 *
 * The platform ships ONE DNA (see dna-defaults.css). A tenant may pick an
 * accent from this fixed, macOS-inspired (but more vibrant) palette to re-tint
 * THREE surfaces of their own views — and only their own:
 *   1. brand tokens   — `--primary` (+ derivatives) and `--glow-brand`
 *   2. chart palette   — EVERY chart color (`--chart-0..8` AND the 6 heatmap/
 *                        continuous ramps), all DERIVED from the accent hue so
 *                        no chart color is a fixed semantic (no hardcoded green)
 *   3. Zincro AI glow  — the rotating HDR ring's from→to colors
 *
 * `multicolor` is the IDENTITY accent: it emits nothing, so the platform DNA
 * shows through unchanged (current behavior). This is the single source of
 * truth — call sites read tokens/RGBA from here, never literal colors (S16).
 *
 * Series colors are an ANALOGOUS set clustered near the accent hue (not a
 * wheel-spanning rainbow): the whole chart reads as the tenant's color family,
 * distinguished by hue micro-shifts + a lightness stagger. Ramps re-anchor to
 * hues near the accent too, so a heatmap on a Blue theme is a blue ramp.
 *
 * Colors are OKLCH for the CSS-var channel (browsers resolve it; charts + UI
 * read these vars) and normalized-RGBA for the AI-glow channel (the HDR canvas
 * paints from RGBA constants, not CSS vars — see ai-glow-ring.ts).
 */

import type { RGBA } from './chart-vertices.js';
import type { GlowColors } from './ai-glow-ring.js';

export type AccentId =
    | 'multicolor' | 'blue' | 'purple' | 'pink' | 'red'
    | 'orange' | 'yellow' | 'green' | 'graphite';

/** The 6 ramp keys the graph engine reads (svg-color-schemes RAMPS). Every
 *  accent re-emits all six, re-hued near the accent — so heatmap/choropleth/
 *  any continuous chart inherit the theme instead of fixed azure/teal/etc. */
export type RampName = 'azure' | 'crimson' | 'amber' | 'violet' | 'orange' | 'teal';

export interface AccentTheme {
    id: AccentId;
    label: string;
    /** Swatch shown in the picker. `null` for multicolor (it renders the
     *  conic rainbow, not a flat fill). */
    swatch: string | null;
    /** Brand `--primary`, light + dark surface. Dark floors lightness so the
     *  accent stays legible as a foreground/glow on dark (cf. --primary-text). */
    primary?: { light: string; dark: string };
    /** `--chart-0..8` — analogous series colors clustered near the accent. */
    chart?: { light: string[]; dark: string[] };
    /** The 6 ramps (5 stops each), all re-hued near the accent. Indexed by
     *  RampName so the same keys the engine asks for (azure/teal/…) resolve to
     *  on-theme gradients. */
    ramps?: { light: Record<RampName, string[]>; dark: Record<RampName, string[]> };
    /** AI-glow sweep endpoints (normalized 0..1 RGB), in the accent family. */
    aiGlow?: GlowColors;
}

/* ── Palette derivation (everything from the accent hue) ──────
 * SERIES (chart-0..8): an analogous fan. Each slot shifts hue by a small,
 * symmetric offset around the accent (±36° across the 9 slots) and staggers
 * lightness — so the 9 series stay mutually distinguishable yet all read as
 * the tenant's color family. Slot 0 (single-series color) sits ON the accent.
 * RAMPS: the 6 named ramps re-anchor to hues NEAR the accent (the same small
 * offsets), each a 5-stop lightness ramp (light→dark surfaces invert the L
 * curve, mirroring dna-defaults' formula). `chroma` lets the near-achromatic
 * Graphite stay grey while colored accents stay vivid. */
const SERIES_HUE_OFFSET = [0, 18, -18, 30, -30, 12, -12, 36, -36];
const SERIES_L_LIGHT    = [0.62, 0.68, 0.58, 0.72, 0.55, 0.65, 0.60, 0.70, 0.57];
const SERIES_L_DARK     = [0.74, 0.80, 0.70, 0.84, 0.68, 0.77, 0.72, 0.82, 0.69];
const RAMP_HUE_OFFSET: Record<RampName, number> = {
    azure: 0, crimson: 18, amber: -18, violet: 30, orange: -30, teal: 12,
};
const h = (deg: number) => ((deg % 360) + 360) % 360;
/** Round to 3 decimals so derived chroma values (e.g. chroma×0.9) don't emit
 *  float noise like `0.018000000000000002` into the CSS var. */
const r3 = (n: number) => Math.round(n * 1000) / 1000;

function derivePalette(baseHue: number, chroma: number): Pick<AccentTheme, 'chart' | 'ramps'> {
    const chart = {
        light: SERIES_HUE_OFFSET.map((d, i) => `oklch(${SERIES_L_LIGHT[i]} ${chroma} ${h(baseHue + d)})`),
        dark:  SERIES_HUE_OFFSET.map((d, i) => `oklch(${SERIES_L_DARK[i]} ${chroma} ${h(baseHue + d)})`),
    };
    // 5-stop ramp at a hue: pale→deep (light surfaces) / inverted for dark.
    const rampLight = (hue: number) => [0.95, 0.83, 0.70, 0.55, 0.42].map((l, i) =>
        `oklch(${l} ${r3([0.04, 0.10, 0.15, chroma, chroma * 0.9][i])} ${hue})`);
    const rampDark = (hue: number) => [0.42, 0.55, 0.70, 0.83, 0.92].map((l, i) =>
        `oklch(${l} ${r3([chroma * 0.9, chroma, 0.15, 0.10, 0.05][i])} ${hue})`);
    const keys = Object.keys(RAMP_HUE_OFFSET) as RampName[];
    const ramps = {
        light: Object.fromEntries(keys.map(k => [k, rampLight(h(baseHue + RAMP_HUE_OFFSET[k]))])) as Record<RampName, string[]>,
        dark:  Object.fromEntries(keys.map(k => [k, rampDark(h(baseHue + RAMP_HUE_OFFSET[k]))]))  as Record<RampName, string[]>,
    };
    return { chart, ramps };
}

/** Normalized-RGB helper for the glow endpoints (0..1 per channel). */
const rgb = (r: number, g: number, b: number): RGBA => ({ r, g, b, a: 1 });

/* Each named accent: brand primary (light/dark), a fully-derived chart palette
 * + ramps clustered on the accent hue, and a two-stop AI glow in the accent
 * family. Hues/chroma below match the swatch hex. multicolor carries no
 * overrides (platform DNA shows through). */
export const ACCENT_THEMES: Record<AccentId, AccentTheme> = {
    multicolor: { id: 'multicolor', label: 'Multicolor', swatch: null },
    blue: {
        id: 'blue', label: 'Blue', swatch: '#2f7bff',
        primary: { light: 'oklch(0.58 0.20 262)', dark: 'oklch(0.74 0.17 262)' },
        ...derivePalette(262, 0.17),
        aiGlow: { from: rgb(0.18, 0.55, 1.0), to: rgb(0.42, 0.12, 1.0) },
    },
    purple: {
        id: 'purple', label: 'Purple', swatch: '#a855e0',
        primary: { light: 'oklch(0.58 0.21 308)', dark: 'oklch(0.74 0.18 308)' },
        ...derivePalette(308, 0.18),
        aiGlow: { from: rgb(0.66, 0.28, 1.0), to: rgb(1.0, 0.32, 0.82) },
    },
    pink: {
        id: 'pink', label: 'Pink', swatch: '#ec4d8e',
        primary: { light: 'oklch(0.62 0.22 358)', dark: 'oklch(0.76 0.19 358)' },
        ...derivePalette(358, 0.18),
        aiGlow: { from: rgb(1.0, 0.30, 0.62), to: rgb(0.78, 0.16, 1.0) },
    },
    red: {
        id: 'red', label: 'Red', swatch: '#f0463c',
        primary: { light: 'oklch(0.62 0.22 27)', dark: 'oklch(0.76 0.19 27)' },
        ...derivePalette(27, 0.18),
        aiGlow: { from: rgb(1.0, 0.30, 0.20), to: rgb(1.0, 0.55, 0.0) },
    },
    orange: {
        id: 'orange', label: 'Orange', swatch: '#f59230',
        primary: { light: 'oklch(0.70 0.18 60)', dark: 'oklch(0.80 0.16 60)' },
        ...derivePalette(60, 0.16),
        aiGlow: { from: rgb(1.0, 0.58, 0.0), to: rgb(1.0, 0.30, 0.18) },
    },
    yellow: {
        id: 'yellow', label: 'Yellow', swatch: '#f5c531',
        primary: { light: 'oklch(0.80 0.16 95)', dark: 'oklch(0.86 0.15 95)' },
        ...derivePalette(95, 0.15),
        aiGlow: { from: rgb(1.0, 0.82, 0.18), to: rgb(1.0, 0.50, 0.0) },
    },
    green: {
        id: 'green', label: 'Green', swatch: '#3fb853',
        primary: { light: 'oklch(0.66 0.17 150)', dark: 'oklch(0.78 0.15 150)' },
        ...derivePalette(150, 0.15),
        aiGlow: { from: rgb(0.28, 0.82, 0.40), to: rgb(0.0, 0.62, 0.78) },
    },
    graphite: {
        id: 'graphite', label: 'Graphite', swatch: '#9499a3',
        primary: { light: 'oklch(0.52 0.012 260)', dark: 'oklch(0.78 0.012 260)' },
        ...derivePalette(260, 0.02),
        aiGlow: { from: rgb(0.62, 0.66, 0.72), to: rgb(0.40, 0.44, 0.52) },
    },
};

export const ACCENT_ORDER: AccentId[] = [
    'multicolor', 'blue', 'purple', 'pink', 'red',
    'orange', 'yellow', 'green', 'graphite',
];

export const DEFAULT_ACCENT: AccentId = 'multicolor';

export function resolveAccent(id: string | undefined): AccentTheme {
    return ACCENT_THEMES[(id as AccentId)] ?? ACCENT_THEMES[DEFAULT_ACCENT];
}

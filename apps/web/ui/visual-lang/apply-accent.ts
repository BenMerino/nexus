/**
 * Resolve an accent THEME into the inline `:root` CSS-var overrides that
 * re-tint a tenant's brand + chart surfaces. Pure: (accent, dark) → var map.
 *
 * Inline `:root` style wins over the stylesheet `dna-defaults.css`, so setting
 * these is a non-destructive override of the platform DNA — clearing them
 * (the `multicolor` case → empty map) restores the platform default. The same
 * map is used by the App-level applier AND the pre-paint head snippet, so the
 * accent never flashes the platform color before React mounts.
 *
 * The AI-glow channel is NOT here — it paints from RGBA constants, not CSS
 * vars, so it flows through ThemeAccentContext instead (see that file).
 */

import { resolveAccent } from './accent-themes.js';

/** CSS-var name → value. Empty for `multicolor` (platform DNA shows through).
 *  Emits brand tokens, the full `--chart-0..8` series palette, AND every
 *  heatmap/continuous ramp stop (`--ramp-<name>-1..5`) — so NO chart color is
 *  left at a platform default; all derive from the accent. */
export function accentVars(accentId: string | undefined, dark: boolean): Record<string, string> {
    const a = resolveAccent(accentId);
    if (!a.primary || !a.chart || !a.ramps) return {};     // multicolor / identity
    const primary = dark ? a.primary.dark : a.primary.light;
    const chart = dark ? a.chart.dark : a.chart.light;
    const ramps = dark ? a.ramps.dark : a.ramps.light;
    const vars: Record<string, string> = {
        '--primary': primary,
        '--primary-text': primary,     // accent is tuned legible per-mode; reuse as text
        '--glow-brand': `color-mix(in oklch, ${primary} 14%, transparent)`,
    };
    chart.forEach((c, i) => { vars[`--chart-${i}`] = c; });
    Object.entries(ramps).forEach(([name, stops]) =>
        stops.forEach((c, i) => { vars[`--ramp-${name}-${i + 1}`] = c; }));
    return vars;
}

/** Apply (or clear) the accent vars on an element's inline style. Setting an
 *  empty map removes any previously-set accent props so `multicolor` reverts
 *  cleanly. `prev` is the var set from the last apply (to know what to clear). */
export function writeAccentVars(
    el: HTMLElement, accentId: string | undefined, dark: boolean, prev: string[],
): string[] {
    prev.forEach(name => el.style.removeProperty(name));
    const vars = accentVars(accentId, dark);
    Object.entries(vars).forEach(([name, value]) => el.style.setProperty(name, value));
    return Object.keys(vars);
}

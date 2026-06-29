/* ── aurora palette ────────────────────────────────────────
 * Aurora is ONE variant now, DERIVED from the day/night sun pipeline. The
 * pipeline (public/sky/) writes a sky-driven --accent onto :root every minute
 * (violet at night → amber at golden hour → blue at midday). Aurora samples that
 * live hue and rebuilds the SAME 4-stop spread the old fixed palettes had — an
 * airy light stop → vibrant mid → deep stop, with a symmetric hue fan — so the
 * mesh keeps its depth/beauty while the whole gradient shifts with the sky. */

import { resolveColor } from '../visual-lang/index.js';

// rgb(0..1) → HSL (h°, s%, l%). Small local helper (visual-lang has the inverse).
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0;
    if (d > 1e-6) {
        if (mx === r) h = ((g - b) / d) % 6;
        else if (mx === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h = (h * 60 + 360) % 360;
    }
    const l = (mx + mn) / 2;
    const s = d < 1e-6 ? 0 : d / (1 - Math.abs(2 * l - 1));
    return [h, s * 100, l * 100];
}

const HUE_FAN = 40; // ° — symmetric fan, as the original palette used
const hsl = (h: number, s: number, l: number) => `hsl(${((h % 360) + 360) % 360} ${s}% ${l}%)`;

/** Aurora's 4 gradient stops, fanned + laddered around the LIVE sky hue (from
 *  --accent). Same shape the old buildPalette emitted (light airy → deep
 *  vibrant) so the mesh has depth; only the base hue is now sun-driven. The
 *  shader re-calls this each frame, so it tracks the sky. Falls back to a blue
 *  family if the pipeline isn't mounted (accent unresolved). */
export function sunStops(): string[] {
    // Sample the live sky accent → its hue + saturation drive the whole fan.
    const [r, g, b] = resolveColor('var(--accent, #4f6df0)');
    const [h, sRaw] = rgbToHsl(r, g, b);
    const s = Math.max(55, Math.min(92, sRaw || 80)); // keep it vivid even from pastels
    // Lightest stop capped at L66 (not 74): the label is a static white (the
    // mesh lightness is fixed ~mid all day, so white always wins — no flip
    // needed), and 66 keeps white's contrast comfortable (gap ≥34) even where
    // the airy blob surfaces under the text. Still 32% L spread → mesh depth.
    return [
        hsl(h - HUE_FAN, s - 12, 66),       // 1 lightest, airy (fanned, capped)
        hsl(h - HUE_FAN * 0.4, s, 62),      // 2 light, cute side
        hsl(h, s, 48),                      // 3 vibrant mid — the identity
        hsl(h + HUE_FAN * 0.3, s, 34),      // 4 deep vibrant
    ];
}

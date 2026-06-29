// Sun-driven surface tokens. The SAME solar altitude that paints the sky also
// sets the glass surface lightness: day → light glass, night → dark glass, a
// continuous interpolation (NO hue tint — pure neutral lightness, chroma 0).
// Written as inline styles on :root, the same channel the theme handler uses
// (N6) — so these win over the CSS baseline and update live with the sky tick.
//
// SCOPE: surfaces + fg here; color tokens (accent, --chart-*, status) are added
// by sky-colors.ts, which interpolates the design's own tuned dark↔light anchors
// (hues fixed → series keep their separation). The --ramp-*/--j-* sets stay
// static (rarely used, no light anchors to blend).

import { sunColors } from "./sky-colors";

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Altitude → day factor: night (≤ −6°) = 0, full day (≥ +10°) = 1, smooth
// through twilight. Same ramp drives every surface token.
export const dayFactor = (altitude: number) => clamp((altitude + 6) / 16, 0, 1);

// Neutral-gray endpoints (oklch L, chroma 0, hue 0). NIGHT = the current dark
// baseline; DAY = a light-mode neutral set. Day surfaces stop short of pure
// white (card 0.96) so the dawn/dusk fg-flip keeps comfortable contrast.
const NIGHT = { bg: 0.16, elev: 0.20, card: 0.22, inset: 0.14, border: 0.32, borderSoft: 0.27 };
const DAY   = { bg: 0.95, elev: 0.97, card: 0.96, inset: 0.92, border: 0.82, borderSoft: 0.88 };

// fg is a HARD flip, not a crossfade: text color crossing through mid-gray on a
// mid-gray surface would collapse contrast. Light text below the flip, dark text
// above. Threshold 0.46 maximizes the worst-case fg/surface contrast.
const FLIP = 0.46;
const gray = (L: number) => `oklch(${L.toFixed(3)} 0 0)`;

export function sunTokens(altitude: number): Record<string, string> {
  const f = dayFactor(altitude);
  const light = f >= FLIP;
  const L = (k: keyof typeof NIGHT) => gray(lerp(NIGHT[k], DAY[k], f));

  return {
    "--bg": L("bg"),
    "--bg-elev": L("elev"),
    "--bg-card": L("card"),
    "--bg-inset": L("inset"),
    "--border": L("border"),
    "--border-soft": L("borderSoft"),
    "--fg": light ? gray(0.20) : gray(0.96),
    "--fg-muted": light ? gray(0.42) : gray(0.72),
    "--fg-dim": light ? gray(0.55) : gray(0.55),
    // color-scheme so native form controls / scrollbars match the surface.
    "color-scheme": light ? "light" : "dark",
  };
}

export function applySunTokens(altitude: number) {
  const f = dayFactor(altitude);
  const root = document.documentElement;
  const toks = { ...sunTokens(altitude), ...sunColors(altitude, f) };
  for (const [k, v] of Object.entries(toks)) root.style.setProperty(k, v);
}

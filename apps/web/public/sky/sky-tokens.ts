// Sun-driven surface tokens. The SAME solar altitude that paints the sky also
// sets the glass surface lightness: day → light glass, night → dark glass, a
// continuous interpolation (NO hue tint — pure neutral lightness, chroma 0).
// Written as inline styles on :root, the same channel the theme handler uses
// (N6) — so these win over the CSS baseline and update live with the sky tick.
//
// SCOPE: surfaces + fg here; color tokens (accent, --chart-*, --j-* KPI) are
// added by sky-colors.ts, derived from the live sky hue. --ramp-* stays static
// (sequential ramps, rarely used); status colors stay semantic.

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

const gray = (L: number) => `oklch(${L.toFixed(3)} 0 0)`;

// Text is DERIVED from the surface it sits on, not hard-flipped at a fixed point.
// The old fixed flip left a twilight hole: the card surface ramps continuously to
// mid-gray, but text only flipped at dayFactor 0.46 — so around sunset (card
// ~0.45, text still dark-theme light-gray) the muted/dim greys collapsed into the
// surface (gap 0.10, "invisible"). Now each text role sits a GUARANTEED lightness
// gap from the live card on its opposite side, so contrast holds at every
// altitude (worst gap ~0.38 vs the old 0.10). fg=strongest, dim=softest, all legible.
const cardL = (f: number) => lerp(NIGHT.card, DAY.card, f);
function textOn(card: number, gap: number): string {
  // Dark surface → light text (card+gap); light surface → dark text (card−gap).
  const L = card < 0.5 ? clamp(card + gap, 0, 1) : clamp(card - gap, 0, 1);
  return gray(L);
}

// "Light" once the dominant surface passes mid-gray — same crossover the text
// uses, so data-theme + the [data-theme=light] CSS stay consistent with it.
export const isLightSky = (altitude: number) => cardL(dayFactor(altitude)) >= 0.5;

export function sunTokens(altitude: number): Record<string, string> {
  const f = dayFactor(altitude);
  const card = cardL(f);
  const L = (k: keyof typeof NIGHT) => gray(lerp(NIGHT[k], DAY[k], f));

  return {
    "--bg": L("bg"),
    "--bg-elev": L("elev"),
    "--bg-card": L("card"),
    "--bg-inset": L("inset"),
    "--border": L("border"),
    "--border-soft": L("borderSoft"),
    // Contrast tiers off the live card lightness — never collapse into it.
    "--fg": textOn(card, 0.74),
    "--fg-muted": textOn(card, 0.50),
    "--fg-dim": textOn(card, 0.38),
    "color-scheme": card < 0.5 ? "dark" : "light",
  };
}

export function applySunTokens(altitude: number) {
  const f = dayFactor(altitude);
  const root = document.documentElement;
  // Keep data-theme in sync so the [data-theme="light"] CSS blocks (the static
  // non-surface light values: bg-inset, status, etc.) match the sky's half.
  root.setAttribute("data-theme", isLightSky(altitude) ? "light" : "dark");
  const toks = { ...sunTokens(altitude), ...sunColors(altitude, f) };
  for (const [k, v] of Object.entries(toks)) root.style.setProperty(k, v);
}

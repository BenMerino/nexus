// Sun-driven COLOR tokens from a CONTINUOUS [primary, companion] pair. The pair
// is keyframed at altitudes and interpolated IN RGB for any sun position, so
// colors drift gradually with no snapping. RGB blending (not hue rotation) means
// a transition between opposite hues (amber↔blue) passes through a desaturated
// neutral midpoint — never inventing green or pink along the way.
//
// ONE source: the pair drives --accent, the --chart-* series (alternating
// primary/companion), the --j-* KPI tokens, and the raw --sky-primary/
// --sky-companion tokens the aurora mesh reads. No loose horses.
// Status colors (--ok/--warn/--err) stay semantic (left to shared.css).

type RGB = [number, number, number];
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mix = (A: RGB, B: RGB, t: number): RGB =>
  [lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)];

// Keyframes: [altitude, primaryRGB, companionRGB]. VOLCANIC scheme: night =
// deep purple/blue pair; day = warm molten-lava accent + ember companion.
// Only two altitudes are ever requested (forced day/night — see
// sky-mode.ts), so this is a straight lookup.
const KEYS: { alt: number; p: RGB; c: RGB }[] = [
  { alt: -18, p: [96, 66, 150],  c: [110, 70, 130] }, // deep night: deep purple + violet-blue
  { alt: 60,  p: [236, 96, 44],  c: [242, 150, 84] }, // day: molten-lava accent + ember companion — volcanic, never blue
];

function pairAt(altitude: number): [RGB, RGB] {
  const k = altitude >= 0 ? KEYS[1] : KEYS[0];
  return [k.p, k.c];
}

const rgb = (c: RGB) => `rgb(${Math.round(c[0])} ${Math.round(c[1])} ${Math.round(c[2])})`;
const shade = (c: RGB, d: number): RGB =>
  d >= 0 ? mix(c, [255, 255, 255], d) : mix(c, [0, 0, 0], -d);

// RGB(0..255) → [h°, s%, l%], for fanning the chart series around a base hue.
function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
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
const hslStr = (h: number, s: number, l: number) =>
  `hsl(${(((h % 360) + 360) % 360).toFixed(1)} ${Math.round(s)}% ${Math.round(l)}%)`;

export function sunColors(altitude: number, dayF: number): Record<string, string> {
  const [primary, companion] = pairAt(altitude);
  const out: Record<string, string> = {};

  out["--primary"] = rgb(primary);
  out["--accent"] = out["--primary"];
  out["--accent-dim"] = rgb(shade(primary, 0.08));

  // Raw pair tokens — the aurora mesh reads exactly these (one source of truth).
  out["--sky-primary"] = rgb(primary);
  out["--sky-companion"] = rgb(companion);

  // Label color for the primary button/gradient (--on-primary). Derived from the
  // GRADIENT's own luminance, not --bg: night gradients are dark (→ white text),
  // day gradients are light (→ dark text). Keys off the pair average so the label
  // contrasts the actual button, fixing the invisible dark-on-dark-violet at night.
  const lum = (c: RGB) => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
  const gradLum = (lum(primary) + lum(companion)) / 2;
  out["--on-primary"] = gradLum < 0.55 ? "oklch(1 0 0)" : "oklch(0.20 0 0)";

  // Charts are the COMPANION family — daylight charts read warm/gold (the
  // sunshine companion), never blue (blue is the accent/primary). LIGHTNESS-
  // dominant: the 9 series step lightness 82→26 (the separation), with only a
  // SMALL 16° hue fan toward the companion's SAFE side (away from the 56–165°
  // green wall). So day stays gold→amber (never coral/red, which belongs to
  // sunrise/sunset), night stays in its blue-cyan band, all 9 stay distinct.
  const [ch, cs] = rgbToHsl(companion);
  const sat = Math.max(58, cs);
  const warm = ch < 90 || ch > 320;    // fan down (toward orange) for warm bases,
  const lTop = lerp(84, 82, dayF);     // up (toward cyan) for cool ones
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const fan = (warm ? -1 : 1) * 16 * t;
    const lt = lTop - 56 * t;          // wide lightness ramp carries the separation
    const h = ((ch + fan) % 360 + 360) % 360;
    out[`--chart-${i}`] = hslStr(h, sat, lt);
  }

  const J = ["--j-sapphire", "--j-amethyst", "--j-emerald", "--j-topaz", "--j-teal", "--j-garnet"];
  J.forEach((name, i) => { out[name] = out[`--chart-${i}`]; });

  // Country/choropleth uses the --ramp-teal sequential scale (low→high value).
  // Drive it from the companion hue so the map tracks the sky, but KEEP the
  // low→high lightness ordering (1 dark = low, 5 light = high) so the data scale
  // stays readable — only the hue shifts with the day, not the ordering.
  const rampL = [34, 48, 62, 74, 84];   // dark→light, low→high value
  for (let i = 0; i < 5; i++) {
    out[`--ramp-teal-${i + 1}`] = hslStr(ch, sat, rampL[i]);
  }
  return out;
}

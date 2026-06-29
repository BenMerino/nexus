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

// Keyframes: [altitude, primaryRGB, companionRGB]. The "day = light blue +
// sunshine" scheme. Between bands we lerp the RGB, so amber→blue fades through
// neutral, not through green/pink.
const KEYS: { alt: number; p: RGB; c: RGB }[] = [
  { alt: -18, p: [70, 58, 120],  c: [78, 110, 150] }, // deep night: violet + steel blue
  { alt: -6,  p: [92, 74, 150],  c: [86, 124, 168] }, // nautical
  { alt: 0,   p: [224, 96, 92],  c: [236, 150, 110] },// sunrise: warm red + peach
  { alt: 5,   p: [240, 150, 70], c: [240, 120, 96] }, // golden: amber + coral
  { alt: 14,  p: [96, 152, 224], c: [248, 196, 96] }, // morning: light blue + sunshine
  { alt: 60,  p: [86, 150, 230], c: [250, 200, 100] },// day: light blue + sunshine
];

function pairAt(altitude: number): [RGB, RGB] {
  if (altitude <= KEYS[0].alt) return [KEYS[0].p, KEYS[0].c];
  const last = KEYS[KEYS.length - 1];
  if (altitude >= last.alt) return [last.p, last.c];
  for (let i = 0; i < KEYS.length - 1; i++) {
    const a = KEYS[i], b = KEYS[i + 1];
    if (altitude >= a.alt && altitude <= b.alt) {
      const t = (altitude - a.alt) / (b.alt - a.alt);
      return [mix(a.p, b.p, t), mix(a.c, b.c, t)];
    }
  }
  return [last.p, last.c];
}

const rgb = (c: RGB) => `rgb(${Math.round(c[0])} ${Math.round(c[1])} ${Math.round(c[2])})`;
// Shift an RGB toward lighter/darker for the chart lightness ladder (lerp to
// white above 0, to black below — keeps hue, only changes value).
const shade = (c: RGB, d: number): RGB =>
  d >= 0 ? mix(c, [255, 255, 255], d) : mix(c, [0, 0, 0], -d);

// Chart series: alternate primary / companion, stepping lightness so same-hue
// series stay distinct. dayF tilts the ladder lighter at night / darker by day.
const L_STEP = [0, 0.18, -0.16, 0.32, -0.28, 0.10, -0.10, 0.24, -0.22];

export function sunColors(altitude: number, dayF: number): Record<string, string> {
  const [primary, companion] = pairAt(altitude);
  const out: Record<string, string> = {};

  out["--primary"] = rgb(primary);
  out["--accent"] = out["--primary"];
  out["--accent-dim"] = rgb(shade(primary, 0.08));

  // Raw pair tokens — the aurora mesh reads exactly these (one source of truth).
  out["--sky-primary"] = rgb(primary);
  out["--sky-companion"] = rgb(companion);

  // Lighter overall at night (glow on dark), darker by day (read on light).
  const bias = lerp(0.12, -0.12, dayF);
  for (let i = 0; i < 9; i++) {
    const base = i % 2 === 0 ? primary : companion;
    out[`--chart-${i}`] = rgb(shade(base, clamp(bias + L_STEP[i], -0.5, 0.5)));
  }

  const J = ["--j-sapphire", "--j-amethyst", "--j-emerald", "--j-topaz", "--j-teal", "--j-garnet"];
  J.forEach((name, i) => { out[name] = out[`--chart-${i}`]; });
  return out;
}

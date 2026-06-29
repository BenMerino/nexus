// Sun-driven COLOR tokens from a CONTINUOUS [primary, companion] pair. The pair
// is keyframed at altitudes and interpolated for any sun position, so colors
// drift GRADUALLY (no snapping at band boundaries). The "day = light blue +
// sunshine" scheme; hue interpolation is routed to never sweep through green.
//
// ONE source: the pair drives --accent, the --chart-* series (alternating
// primary/companion), the --j-* KPI tokens, and the raw --sky-primary/
// --sky-companion tokens the aurora mesh reads. No loose horses.
// Status colors (--ok/--warn/--err) stay semantic (left to shared.css).

type HSL = [number, number, number];
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
// Shortest-arc hue lerp, EXCEPT the keyframes below are spaced so the amber→blue
// transition routes the long way (through red/violet), never through green.
const hueLerp = (a: number, b: number, t: number) => {
  const d = ((b - a + 540) % 360) - 180;
  return (((a + d * t) % 360) + 360) % 360;
};
const triLerp = (A: HSL, B: HSL, t: number): HSL =>
  [hueLerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)];

// Keyframes: [altitude, primary, companion]. Between golden and morning the
// primary deliberately steps amber→red→violet→blue (the long way) so no
// in-between hue lands in the 58–158° green zone.
const KEYS: { alt: number; p: HSL; c: HSL }[] = [
  { alt: -18, p: [255, 45, 38], c: [210, 50, 55] }, // deep night: violet + steel blue
  { alt: -6,  p: [252, 48, 44], c: [215, 52, 58] }, // nautical
  { alt: 0,   p: [12, 82, 56],  c: [345, 55, 60] }, // sunrise: red + pink
  { alt: 5,   p: [34, 88, 58],  c: [12, 80, 62] },  // golden: amber + coral
  { alt: 10,  p: [8, 78, 58],   c: [40, 80, 60] },  // pull primary back toward red…
  { alt: 16,  p: [250, 55, 58], c: [44, 88, 62] },  // …then wrap red→violet→blue; sunshine companion
  { alt: 60,  p: [212, 72, 60], c: [46, 92, 62] },  // day: light blue + sunshine
];

function pairAt(altitude: number): [HSL, HSL] {
  if (altitude <= KEYS[0].alt) return [KEYS[0].p, KEYS[0].c];
  const last = KEYS[KEYS.length - 1];
  if (altitude >= last.alt) return [last.p, last.c];
  for (let i = 0; i < KEYS.length - 1; i++) {
    const a = KEYS[i], b = KEYS[i + 1];
    if (altitude >= a.alt && altitude <= b.alt) {
      const t = (altitude - a.alt) / (b.alt - a.alt);
      return [triLerp(a.p, b.p, t), triLerp(a.c, b.c, t)];
    }
  }
  return [last.p, last.c];
}

const hsl = ([h, s, l]: HSL) => `hsl(${h.toFixed(1)} ${Math.round(s)}% ${Math.round(l)}%)`;
const withL = ([h, s]: HSL, l: number): HSL => [h, s, clamp(l, 22, 86)];

// Chart series: alternate primary / companion, stepping lightness so same-hue
// series stay distinct. dayF tilts the ladder lighter at night / darker by day.
const L_STEP = [0, 14, -12, 24, -20, 8, -8, 18, -16];

export function sunColors(altitude: number, dayF: number): Record<string, string> {
  const [primary, companion] = pairAt(altitude);
  const out: Record<string, string> = {};

  out["--primary"] = hsl(primary);
  out["--accent"] = out["--primary"];
  out["--accent-dim"] = hsl(withL(primary, primary[2] + 6));

  // Raw pair tokens — the aurora mesh reads exactly these (one source of truth).
  out["--sky-primary"] = hsl(primary);
  out["--sky-companion"] = hsl(companion);

  const baseL = 70 - 22 * dayF;
  for (let i = 0; i < 9; i++) {
    const base = i % 2 === 0 ? primary : companion;
    out[`--chart-${i}`] = hsl(withL(base, baseL + L_STEP[i]));
  }

  const J = ["--j-sapphire", "--j-amethyst", "--j-emerald", "--j-topaz", "--j-teal", "--j-garnet"];
  J.forEach((name, i) => { out[name] = out[`--chart-${i}`]; });
  return out;
}

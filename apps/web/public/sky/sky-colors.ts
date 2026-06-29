// Sun-driven COLOR tokens (accent, chart series, status). Unlike the neutral
// surfaces, these are NOT invented from scratch — the design already ships tuned
// DARK (:root) and LIGHT (:root[data-theme=light]) values for every one. We just
// interpolate between those two anchors by the same dayFactor, so:
//   • night → the tuned dark palette, day → the tuned light palette;
//   • hues stay FIXED (copper family), only L + C blend → series never lose their
//     separation (verified: L-spread is preserved through twilight).
// Accent additionally picks up a small WARMTH nudge at golden hour.

type LCH = [number, number, number]; // [lightness, chroma, hue]
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lch = (c: LCH) => `oklch(${c[0].toFixed(3)} ${c[1].toFixed(3)} ${c[2].toFixed(1)})`;
// Blend L and C between dark/light anchors; hue from the (shared) dark anchor.
const blend = (d: LCH, l: LCH, f: number): LCH => [lerp(d[0], l[0], f), lerp(d[1], l[1], f), d[2]];

// [dark, light] anchor pairs, lifted verbatim from shared.css.
const PAIRS: Record<string, [LCH, LCH]> = {
  "--primary":   [[0.62, 0.13, 45], [0.52, 0.12, 45]],
  "--accent-dim":[[0.66, 0.10, 45], [0.56, 0.10, 45]],
  "--ok":        [[0.78, 0.14, 145], [0.58, 0.14, 145]],
  "--warn":      [[0.80, 0.14, 80], [0.62, 0.13, 80]],
  "--err":       [[0.68, 0.18, 25], [0.55, 0.20, 25]],
  "--chart-0":   [[0.64, 0.13, 45], [0.52, 0.13, 45]],
  "--chart-1":   [[0.58, 0.14, 28], [0.48, 0.14, 28]],
  "--chart-2":   [[0.72, 0.12, 72], [0.60, 0.13, 72]],
  "--chart-3":   [[0.52, 0.13, 38], [0.46, 0.13, 38]],
  "--chart-4":   [[0.68, 0.11, 60], [0.56, 0.12, 60]],
  "--chart-5":   [[0.78, 0.12, 82], [0.64, 0.13, 82]],
  "--chart-6":   [[0.50, 0.13, 22], [0.46, 0.14, 22]],
  "--chart-7":   [[0.73, 0.10, 52], [0.60, 0.11, 52]],
  "--chart-8":   [[0.60, 0.14, 35], [0.50, 0.14, 35]],
};

// Golden-hour warmth: near the horizon (|alt|→0) nudge the accent hue a few
// degrees toward orange and lift chroma slightly. Fades out by ~10°.
function warmAccent(c: LCH, altitude: number): LCH {
  const s = Math.max(0, 1 - Math.abs(altitude) / 10);
  if (s <= 0) return c;
  return [c[0], c[1] + 0.02 * s, c[2] - 8 * s]; // hue 45 → ~37 (more orange) at peak
}

export function sunColors(altitude: number, f: number): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, [d, l]] of Object.entries(PAIRS)) {
    let v = blend(d, l, f);
    if (name === "--primary" || name === "--accent-dim") v = warmAccent(v, altitude);
    out[name] = lch(v);
  }
  out["--accent"] = out["--primary"]; // accent mirrors primary (as in shared.css)
  return out;
}

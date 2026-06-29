// Sun-driven COLOR tokens, from a HAND-PICKED [primary, companion] pair per
// time-of-day band (the "day = light blue + sunshine" scheme). Two curated hues
// per band — no hue-fan math, so colors never drift into green. ONE source: the
// pair drives --accent, the --chart-* series, the --j-* KPI tokens, AND the two
// raw --sky-primary/--sky-companion tokens the aurora mesh reads. No loose horses.
//
// Status colors (--ok/--warn/--err) are NOT overridden — green/amber/red must
// stay semantic. Left to shared.css.

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// The pair, by altitude band: [primary, companion] as [h, s, l].
type HSL = [number, number, number];
function pair(altitude: number): [HSL, HSL] {
  if (altitude < -6) return [[255, 45, 40], [190, 55, 58]]; // night: violet + cool cyan
  if (altitude < 4)  return [[30, 88, 58],  [8, 82, 60]];   // golden: amber + coral
  return [[210, 72, 60], [45, 92, 62]];                      // day: light blue + sunshine
}
const hsl = ([h, s, l]: HSL) => `hsl(${h} ${Math.round(s)}% ${Math.round(l)}%)`;
const withL = ([h, s]: HSL, l: number): HSL => [h, s, clamp(l, 22, 86)];

// Chart series: alternate primary / companion, stepping lightness so multiple
// series of the same hue stay distinct. dayF tilts the ladder (lighter at night
// for glow on dark surfaces, darker by day to read on light ones).
const L_STEP = [0, 14, -12, 24, -20, 8, -8, 18, -16];

export function sunColors(altitude: number, dayF: number): Record<string, string> {
  const [primary, companion] = pair(altitude);
  const out: Record<string, string> = {};

  // Accent = the primary of the pair.
  out["--primary"] = hsl(primary);
  out["--accent"] = out["--primary"];
  out["--accent-dim"] = hsl(withL(primary, primary[2] + 6));

  // Raw pair tokens — the aurora mesh reads exactly these (one source of truth).
  out["--sky-primary"] = hsl(primary);
  out["--sky-companion"] = hsl(companion);

  // Chart series: even index = primary family, odd = companion family.
  const baseL = 70 - 22 * dayF;
  for (let i = 0; i < 9; i++) {
    const base = i % 2 === 0 ? primary : companion;
    out[`--chart-${i}`] = hsl(withL(base, baseL + L_STEP[i]));
  }

  // KPI jewel tokens alias onto the chart series (no separate KPI palette).
  const J = ["--j-sapphire", "--j-amethyst", "--j-emerald", "--j-topaz", "--j-teal", "--j-garnet"];
  J.forEach((name, i) => { out[name] = out[`--chart-${i}`]; });
  return out;
}

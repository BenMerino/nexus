// Sky palette by solar altitude (sRGB 0..255). top = sky dome (overhead),
// hor = horizon band. Through twilight + golden hour the TOP warms too
// (violet→mauve→peach→amber) so the whole dome glows at sunrise/sunset — not
// just a warm strip under a cold blue sky. Night + full day stay blue.

type RGB = [number, number, number];
interface Stop { alt: number; top: RGB; hor: RGB; }
export interface Sky { top: RGB; hor: RGB; }

const STOPS: Stop[] = [
  { alt: -18, top: [12, 14, 30],   hor: [20, 18, 42]   }, // deep night
  { alt: -12, top: [22, 22, 52],   hor: [48, 34, 72]   }, // astronomical → violet
  { alt: -6,  top: [52, 42, 86],   hor: [120, 72, 104] }, // nautical, violet horizon
  { alt: -2,  top: [112, 92, 128], hor: [236, 128, 96] }, // civil: dome warms (mauve)
  { alt: 0,   top: [176, 142, 150], hor: [255, 150, 90] }, // sunrise/sunset: peach dome
  { alt: 4,   top: [214, 186, 176], hor: [255, 196, 118] }, // golden hour: amber dome
  { alt: 12,  top: [150, 178, 222], hor: [230, 224, 224] }, // morning: back to blue
  { alt: 30,  top: [86, 150, 224], hor: [190, 216, 240] }, // high sun
  { alt: 60,  top: [58, 128, 222], hor: [170, 206, 240] }, // near-noon zenith blue
];

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mix = (c1: RGB, c2: RGB, t: number): RGB =>
  [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];

export function skyFor(alt: number): Sky {
  if (alt <= STOPS[0].alt) return { top: [...STOPS[0].top], hor: [...STOPS[0].hor] };
  const last = STOPS[STOPS.length - 1];
  if (alt >= last.alt) return { top: [...last.top], hor: [...last.hor] };
  for (let i = 0; i < STOPS.length - 1; i++) {
    const a = STOPS[i], b = STOPS[i + 1];
    if (alt >= a.alt && alt <= b.alt) {
      const t = (alt - a.alt) / (b.alt - a.alt);
      return { top: mix(a.top, b.top, t), hor: mix(a.hor, b.hor, t) };
    }
  }
  return { top: [...last.top], hor: [...last.hor] };
}

// Dawn ≠ dusk — empirical aerosol/humidity tendency (NOT geometry, which is
// symmetric). Dusk air is hazier → warmer/redder; dawn cleaner → cooler/pinker.
// Only near the horizon (fades out by ~10°). `rising` = sun ascending = dawn.
export function twilightTint(sky: Sky, altitude: number, rising: boolean): Sky {
  const s = clamp(1 - Math.abs(altitude) / 10, 0, 1);
  if (s <= 0) return sky;
  const dusk: RGB = [20, 4, -20], dawn: RGB = [-14, -2, 16];
  const d = (rising ? dawn : dusk).map(v => v * s);
  return { top: sky.top, hor: sky.hor.map((v, i) => clamp(v + d[i], 0, 255)) as RGB };
}

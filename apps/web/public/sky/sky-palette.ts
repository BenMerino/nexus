// Sky palette by solar altitude (sRGB 0..255). top = sky dome (overhead),
// hor = horizon band. VOLCANIC scheme: night = grey-black dome + deep
// purple/blue horizon; day = white-grey dome + light blue; and through
// TWILIGHT + golden hour the horizon ERUPTS — magma red → ember orange → ash
// glow — so dawn/dusk read like the volcano is glowing, against an otherwise
// neutral (never saturated-blue) sky. The eruption is the horizon; the dome
// only warms to smoke/ash near it.

type RGB = [number, number, number];
interface Stop { alt: number; top: RGB; hor: RGB; }
export interface Sky { top: RGB; hor: RGB; }

// MONOTONIC dome: brightest at noon, darkening every step as the sun drops to
// night — the sky never brightens as it sets (no golden-hour bump). Twilight
// drama comes from the dome WARMING (reddening) and the lava horizon intensifying,
// NOT from the dome getting lighter. `top` avg brightness must strictly decrease
// from alt +60 → −18; only hue shifts red through twilight.
const STOPS: Stop[] = [
  { alt: -18, top: [10, 9, 14],    hor: [40, 26, 66]   }, // deep night: obsidian dome + deep purple/blue (NO lava)
  { alt: -12, top: [20, 16, 24],   hor: [60, 36, 84]   }, // astronomical: still pure deep violet/blue — no glow yet
  { alt: -6,  top: [32, 24, 30],   hor: [128, 62, 96]  }, // nautical: FAINT ember-violet — the volcano glow just beginning
  { alt: -2,  top: [36, 27, 27],   hor: [220, 78, 52]  }, // civil: dome smokes red, horizon MAGMA
  { alt: 0,   top: [40, 30, 30],   hor: [255, 96, 44]  }, // sunset: red-smoke dome (darker than day), molten eruption
  { alt: 4,   top: [44, 33, 32],   hor: [255, 130, 60] }, // golden hour: warm-red dome, ember horizon — still below noon
  { alt: 12,  top: [48, 37, 34],   hor: [238, 108, 50] }, // morning: dark ash-smoke dome → ember-lava horizon
  { alt: 30,  top: [52, 41, 37],   hor: [244, 100, 44] }, // high sun: heavy ash pall → molten-lava horizon (magma pops)
  { alt: 60,  top: [56, 45, 41],   hor: [248, 94, 38]  }, // noon: darkest-ever ash dome (brightest of the cycle) → hot MAGMA horizon
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

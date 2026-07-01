// Theme mode for the sun pipeline. Two states:
//   day   — pin the sun high, so surfaces/charts/aurora read "light"
//   night — pin the sun deep, so everything reads "dark"
//
// Light/dark are NOT a separate theme system — they clamp the altitude the
// pipeline consumes, so one render path serves both. Sticky in localStorage;
// the boot script (vite.config.ts) reads the same key pre-paint.

export type SkyMode = 'day' | 'night';
export const SKY_MODE_KEY = 'nexus.sky-mode';

// Forced altitudes: high noon vs deep night. Past the palette's day/twilight
// thresholds so the look is unambiguously light / dark.
const DAY_ALT = 60;
const NIGHT_ALT = -18;

export function getSkyMode(): SkyMode {
  try {
    const m = localStorage.getItem(SKY_MODE_KEY);
    if (m === 'day' || m === 'night') return m;
  } catch { /* storage blocked */ }
  return matchMedia('(prefers-color-scheme: light)').matches ? 'day' : 'night';
}

export function setSkyMode(mode: SkyMode): void {
  try { localStorage.setItem(SKY_MODE_KEY, mode); } catch { /* ignore */ }
}

// Header toggle: day → night → day.
export function nextSkyMode(m: SkyMode): SkyMode {
  return m === 'day' ? 'night' : 'day';
}

export function forcedAltitude(mode = getSkyMode()): number {
  return mode === 'day' ? DAY_ALT : NIGHT_ALT;
}

// Theme mode for the sun pipeline. Three states, cycled by the header toggle:
//   live  — the real sun drives everything (the default; what we built)
//   day   — FORCE day: pin the sun high, so surfaces/charts/aurora read "light"
//   night — FORCE night: pin the sun deep, so everything reads "dark"
//
// Light/dark are NOT a separate theme system — they just clamp the altitude the
// pipeline already consumes, so one render path serves all three. Sticky in
// localStorage; the boot script (vite.config.ts) reads the same key pre-paint.

export type SkyMode = 'live' | 'day' | 'night';
export const SKY_MODE_KEY = 'nexus.sky-mode';

// Forced altitudes: high noon vs deep night. Past the palette's day/twilight
// thresholds so the look is unambiguously light / dark.
const DAY_ALT = 60;
const NIGHT_ALT = -18;

export function getSkyMode(): SkyMode {
  try {
    const m = localStorage.getItem(SKY_MODE_KEY);
    if (m === 'day' || m === 'night' || m === 'live') return m;
  } catch { /* storage blocked */ }
  return 'live';
}

export function setSkyMode(mode: SkyMode): void {
  try { localStorage.setItem(SKY_MODE_KEY, mode); } catch { /* ignore */ }
}

// Cycle order: live → day → night → live.
export function nextSkyMode(m: SkyMode): SkyMode {
  return m === 'live' ? 'day' : m === 'day' ? 'night' : 'live';
}

// The altitude the pipeline should actually use: real sun in live mode, pinned
// otherwise. Everything downstream (tokens, gradient, aurora) keys off this.
export function effectiveAltitude(realAltitude: number, mode = getSkyMode()): number {
  if (mode === 'day') return DAY_ALT;
  if (mode === 'night') return NIGHT_ALT;
  return realAltitude;
}

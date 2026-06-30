// Theme mode for the sun pipeline. Four states:
//   live   — the real sun drives everything (the default; what we built)
//   day    — FORCE day: pin the sun high, so surfaces/charts/aurora read "light"
//   night  — FORCE night: pin the sun deep, so everything reads "dark"
//   manual — DEV/PREVIEW: pin an exact time of day (minutes 0–1439); the slider
//            on /dna.html scrubs it. The header toggle only cycles live/day/night;
//            manual is reachable from the dev panel, not the production header.
//
// Light/dark are NOT a separate theme system — they clamp the altitude the
// pipeline consumes, so one render path serves all four. Sticky in localStorage;
// the boot script (vite.config.ts) reads the same key pre-paint.

export type SkyMode = 'live' | 'day' | 'night' | 'manual';
export const SKY_MODE_KEY = 'nexus.sky-mode';
export const SKY_MANUAL_MIN_KEY = 'nexus.sky-manual-min';

// Forced altitudes: high noon vs deep night. Past the palette's day/twilight
// thresholds so the look is unambiguously light / dark.
const DAY_ALT = 60;
const NIGHT_ALT = -18;

export function getSkyMode(): SkyMode {
  try {
    const m = localStorage.getItem(SKY_MODE_KEY);
    if (m === 'day' || m === 'night' || m === 'live' || m === 'manual') return m;
  } catch { /* storage blocked */ }
  return 'live';
}

export function setSkyMode(mode: SkyMode): void {
  try { localStorage.setItem(SKY_MODE_KEY, mode); } catch { /* ignore */ }
}

// Manual scrub time, minutes-of-day (0–1439). Default noon.
export function getManualMinutes(): number {
  try {
    const v = Number(localStorage.getItem(SKY_MANUAL_MIN_KEY));
    if (Number.isFinite(v) && v >= 0 && v <= 1439) return v;
  } catch { /* ignore */ }
  return 720;
}
export function setManualMinutes(min: number): void {
  try { localStorage.setItem(SKY_MANUAL_MIN_KEY, String(Math.round(min))); } catch { /* ignore */ }
}

// Header toggle cycle skips manual: live → day → night → live.
export function nextSkyMode(m: SkyMode): SkyMode {
  return m === 'live' ? 'day' : m === 'day' ? 'night' : 'live';
}

// Altitude clamp for the day/night forced modes (live + manual are computed from
// real coords in sky-bg, which has lat/lon). Returns null when the caller should
// compute the altitude itself (live, manual).
export function forcedAltitude(mode = getSkyMode()): number | null {
  if (mode === 'day') return DAY_ALT;
  if (mode === 'night') return NIGHT_ALT;
  return null; // live / manual → caller computes from coords
}

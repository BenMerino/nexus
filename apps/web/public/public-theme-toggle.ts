// Header theme toggle — a THREE-state cycle over the sun pipeline:
//   live → day → night → live
// 'live' lets the real sun drive the theme (the default); 'day'/'night' pin it
// light/dark. These are NOT a separate theme system — they clamp the altitude
// the sky pipeline (public/sky/) consumes, so one render path serves all three.
// The choice is sticky in localStorage; the no-FOUC boot script (vite.config.ts)
// reads the same key before first paint. Side-effect-free import.

import { getSkyMode, setSkyMode, nextSkyMode, type SkyMode } from './sky/sky-mode';

export type { SkyMode };
export { getSkyMode };

// Cycle to the next mode, persist it, and tell the sky pipeline to repaint
// (sky-bg listens for nexus:sky-mode and re-applies tokens + gradient instantly).
export function cycleSkyMode(): SkyMode {
  const next = nextSkyMode(getSkyMode());
  setSkyMode(next);
  window.dispatchEvent(new CustomEvent('nexus:sky-mode', { detail: next }));
  return next;
}

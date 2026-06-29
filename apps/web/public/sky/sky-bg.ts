// Live sun-driven sky background for the SPA. Replaces the static page backdrop:
// a fixed full-viewport WebGPU canvas (HDR/P3) behind all content, painting the
// real sky for the VIEWER's coordinates + local time, re-rendered each minute.
// Falls back to a CSS gradient on the same element if WebGPU is unavailable.
//
// Self-mounting: importing this module installs the background. One <script>
// injected into every page (see vite.config.ts SKY_BG) is all the wiring needed.

import { sunPosition } from "./sky-sun";
import { skyFor, twilightTint, type Sky } from "./sky-palette";
import { initSkyGPU, type SkyGPU } from "./sky-gpu";
import { applySunTokens } from "./sky-tokens";

type RGB = [number, number, number];
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const rgb = (c: RGB) => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;

// Fallback coordinates if geolocation is denied/unavailable. Not a tenant city —
// just a neutral mid-latitude so the sky still cycles plausibly. Talca-ish.
const FALLBACK = { lat: -35.4264, lon: -71.6554 };
let coords = { ...FALLBACK };

const canvas = document.createElement("canvas");
canvas.id = "sky-bg";
let gpu: SkyGPU | null = null;

function paint() {
  const now = new Date();
  const { altitude, azimuth } = sunPosition(now, coords.lat, coords.lon);
  const rising = azimuth < 180;

  // Drive the glass surface tokens off the same altitude (day→light, night→dark).
  applySunTokens(altitude);
  const sky: Sky = twilightTint(skyFor(altitude), altitude, rising);
  const glowX = clamp(0.5 + (azimuth - 180) / 180 * 0.45, 0.05, 0.95);

  // HDR glow blooms only near the horizon, peaking at sunrise/sunset, capped to
  // the display's real headroom (1.0 on SDR → no over-bright, no wash-out).
  const goldenness = clamp(1 - Math.abs(altitude) / 8, 0, 1);
  const headroom = gpu?.hdr ? 2.0 : 1.0;
  const glowHDR = 1.0 + goldenness * (headroom - 1.0);

  if (gpu) {
    gpu.draw(sky.top, sky.hor, glowX, glowHDR);
  } else {
    canvas.style.background =
      `linear-gradient(to bottom, ${rgb(sky.top)} 0%, ${rgb(sky.top)} 35%, ${rgb(sky.hor)} 100%),` +
      `radial-gradient(120% 80% at ${Math.round(glowX * 100)}% 100%, ${rgb(sky.hor)} 0%, transparent 60%)`;
  }
}

async function start() {
  Object.assign(canvas.style, {
    position: "fixed", inset: "0", zIndex: "0", display: "block", pointerEvents: "none",
  } as CSSStyleDeclaration);
  document.body.prepend(canvas);

  gpu = await initSkyGPU(canvas);
  paint();

  if (gpu) {
    window.addEventListener("resize", () => { gpu!.resize(); paint(); });
  }
  // Live tick: re-render each minute as the sun moves.
  setInterval(paint, 60000);

  // The theme handler (shell-mount) re-applies the static --accent + surface
  // tokens from /api/theme-tokens AFTER us, which would clobber the sky palette.
  // It announces that with this event — re-assert our sun tokens when it fires.
  window.addEventListener("nexus:theme-tokens", () => paint());

  // Real viewer location once granted; keep the fallback sky until then.
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => { coords = { lat: pos.coords.latitude, lon: pos.coords.longitude }; paint(); },
      () => {}, { timeout: 8000 },
    );
  }
}

// Apply sun-driven surface tokens as early as this module runs (fallback coords),
// so the glass lightness is right before the canvas mounts — minimizes the flash
// from the boot-script's cached theme to the live sun theme.
applySunTokens(sunPosition(new Date(), coords.lat, coords.lon).altitude);

if (document.body) start();
else addEventListener("DOMContentLoaded", start, { once: true });

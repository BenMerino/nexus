// Sky background for the SPA: a fixed full-viewport WebGPU canvas (HDR/P3)
// behind all content, painted from the forced day/night sky mode. Falls back
// to a CSS gradient on the same element if WebGPU is unavailable.
//
// Self-mounting: importing this module installs the background. One <script>
// injected into every page (see vite.config.ts SKY_BG) is all the wiring needed.

import { skyFor, type Sky } from "./sky-palette";
import { initSkyGPU, type SkyGPU } from "./sky-gpu";
import { applySunTokens } from "./sky-tokens";
import { getSkyMode, forcedAltitude } from "./sky-mode";
import "../dna-liquid";  // self-mounting: injects the SVG liquid-glass filter

type RGB = [number, number, number];
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const rgb = (c: RGB) => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;

const canvas = document.createElement("canvas");
canvas.id = "sky-bg";
let gpu: SkyGPU | null = null;

// Fine film grain over the sky: a fixed layer above the sky canvas, below all
// chrome (styled in app-chrome.css, painting the shared --glass-grain token).
const grain = document.createElement("div");
grain.id = "sky-grain";

function paint() {
  const altitude = forcedAltitude(getSkyMode());

  applySunTokens(altitude);
  const sky: Sky = skyFor(altitude);
  const glowX = 0.5;

  // HDR glow blooms only near the horizon, peaking at sunrise/sunset, capped to
  // the display's real headroom (1.0 on SDR → no over-bright, no wash-out).
  const goldenness = clamp(1 - Math.abs(altitude) / 8, 0, 1);
  const headroom = gpu?.hdr ? 2.0 : 1.0;
  const glowHDR = 1.0 + goldenness * (headroom - 1.0);

  if (gpu) {
    gpu.draw(sky.top, sky.mid, sky.hor, glowX, glowHDR);
  } else {
    canvas.style.background =
      `linear-gradient(to bottom, ${rgb(sky.top)} 0%, ${rgb(sky.top)} 10%, ${rgb(sky.mid)} 60%, ${rgb(sky.mid)} 95%, ${rgb(sky.hor)} 100%),` +
      `radial-gradient(120% 80% at ${Math.round(glowX * 100)}% 100%, ${rgb(sky.hor)} 0%, transparent 60%)`;
  }
}

async function start() {
  Object.assign(canvas.style, {
    position: "fixed", inset: "0", width: "100%", height: "100%",
    zIndex: "0", display: "block", pointerEvents: "none",
  } as CSSStyleDeclaration);
  document.body.prepend(canvas);
  document.body.insertBefore(grain, canvas.nextSibling);

  gpu = await initSkyGPU(canvas);
  paint();

  if (gpu) {
    window.addEventListener("resize", () => { gpu!.resize(); paint(); });
  }

  // The theme handler (shell-mount) re-applies the static --accent + surface
  // tokens from /api/theme-tokens AFTER us, which would clobber the sky palette.
  // It announces that with this event — re-assert our sun tokens when it fires.
  window.addEventListener("nexus:theme-tokens", () => paint());

  // The header toggle (sky-mode) repaints via this event after switching mode,
  // so day/night applies instantly without a reload.
  window.addEventListener("nexus:sky-mode", () => paint());
}

// Liquid-glass DNA platform-wide: sky-bg loads on EVERY page, so enabling it here
// applies the SVG-refraction glass everywhere (Chrome/Edge; @supports-guarded).
document.documentElement.setAttribute("data-liquid", "");

// Apply the forced sky tokens as early as this module runs, so the glass
// lightness is right before the canvas mounts — minimizes the boot-script flash.
applySunTokens(forcedAltitude(getSkyMode()));

if (document.body) start();
else addEventListener("DOMContentLoaded", start, { once: true });

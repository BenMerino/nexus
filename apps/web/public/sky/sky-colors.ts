// Sun-driven COLOR tokens, DERIVED FROM THE SKY ITSELF — not the static copper
// theme. The accent + chart series take the live sky's dominant hue (blue by
// day, amber/orange at golden hour, violet at night), so the platform's whole
// color identity tracks the gradient. Lightness tilts with day/night so series
// stay legible on the (also sun-driven) surfaces.
//
// Status colors (--ok/--warn/--err) are deliberately NOT overridden: green/amber/
// red must stay semantically legible regardless of sky. Left to shared.css.

import { skyFor } from "./sky-palette";

type RGB = [number, number, number];
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// sRGB(0..255) → OKLCH [L, C, H°]. Standard transform.
const lin = (u: number) => { u /= 255; return u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4); };
function rgb2oklch([r, g, b]: RGB): [number, number, number] {
  const R = lin(r), G = lin(g), B = lin(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const Bb = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  let H = Math.atan2(Bb, A) * 180 / Math.PI; if (H < 0) H += 360;
  return [L, Math.hypot(A, Bb), H];
}
const lch = (L: number, C: number, H: number) => `oklch(${L.toFixed(3)} ${C.toFixed(3)} ${H.toFixed(1)})`;

// 9-series fan: hue offsets + lightness steps tuned to keep series separated.
const H_OFF = [0, -14, 12, -8, 16, -18, 8, -12, 18];
const L_STEP = [0, 0.06, -0.05, 0.10, -0.08, 0.04, -0.10, 0.08, -0.03];

export function sunColors(altitude: number, dayF: number): Record<string, string> {
  // Dominant sky hue = the horizon color's hue (the vivid "where the sun is"
  // band). Its chroma sets how saturated the palette reads.
  const sky = skyFor(altitude);
  const [, horC, horH] = rgb2oklch(sky.hor);
  const baseC = clamp(horC + 0.04, 0.07, 0.16);  // floor chroma so day pastels still read
  const out: Record<string, string> = {};

  // Accent = the sky hue at a readable mid-lightness (tilts darker by day so it
  // reads on light surfaces, lighter by night).
  const accentL = lerp(0.66, 0.52, dayF);
  out["--primary"] = lch(accentL, baseC, horH);
  out["--accent"] = out["--primary"];
  out["--accent-dim"] = lch(accentL + 0.04, baseC - 0.03, horH);

  // Chart series fanned from the same hue.
  const baseL = lerp(0.74, 0.50, dayF);
  for (let i = 0; i < 9; i++) {
    const L = clamp(baseL + L_STEP[i], 0.30, 0.86);
    out[`--chart-${i}`] = lch(L, baseC, (horH + H_OFF[i] + 360) % 360);
  }
  return out;
}

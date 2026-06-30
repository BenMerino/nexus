// Fills a 2D displacement-map ImageData from the 1D bevel profile, rounded-rect
// aware so the bevel hugs the card's actual corners. Returns the data URL + the
// maximum displacement in px (which becomes feDisplacementMap's `scale`).
//
// For each pixel: distanceToEdge = how far inside the rounded-rect border it is.
// Within `bezel` px of the edge it lies on the bevel (x = 1 − d/bezel maps edge→
// interior); the local displacement DIRECTION is the outward normal of the
// nearest edge/corner. Magnitude comes from the 1D profile, normalized so the
// peak = 1; the peak (in px) is the returned scale.

import { sampleProfile, type Profile } from "./refraction-math";

export interface MapResult {
  url: string;
  scale: number;
}

// Signed distance from (px,py) to the inside of a rounded rectangle of size
// w×h with corner radius r — positive inside. Also yields the outward normal.
function edgeField(px: number, py: number, w: number, h: number, r: number) {
  // Fold into the first quadrant relative to the rounded-rect's corner box.
  const qx = Math.abs(px - w / 2) - (w / 2 - r);
  const qy = Math.abs(py - h / 2) - (h / 2 - r);
  const sx = px < w / 2 ? -1 : 1;
  const sy = py < h / 2 ? -1 : 1;
  if (qx > 0 && qy > 0) {
    // Corner region — distance to the rounded arc; normal points along (qx,qy).
    const len = Math.hypot(qx, qy) || 1;
    return { dist: r - len, nx: (sx * qx) / len, ny: (sy * qy) / len };
  }
  // Straight edge — nearest side decides the normal.
  if (qx > qy) return { dist: r - qx, nx: sx, ny: 0 };
  return { dist: r - qy, nx: 0, ny: sy };
}

export function buildMap(
  w: number,
  h: number,
  radius: number,
  profile: Profile,
  thickness: number,
  bezel: number,
): MapResult | null {
  const W = Math.max(1, Math.round(w));
  const H = Math.max(1, Math.round(h));
  const r = Math.max(0, Math.min(radius, Math.min(W, H) / 2));
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d");
  if (!ctx) return null;
  const img = ctx.createImageData(W, H);
  const buf = img.data;

  const SAMPLES = 128;
  const profileMags = sampleProfile(profile, thickness, SAMPLES);
  const peak = profileMags.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;

  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const { dist, nx, ny } = edgeField(px + 0.5, py + 0.5, W, H, r);
      let vx = 0;
      let vy = 0;
      if (dist >= 0 && dist <= bezel) {
        // 0 at the edge → 1 at the interior end of the bezel.
        const x = bezel === 0 ? 1 : dist / bezel;
        const idx = Math.min(SAMPLES - 1, Math.round(x * (SAMPLES - 1)));
        const mag = profileMags[idx] / peak; // normalized signed magnitude
        vx = nx * mag;
        vy = ny * mag;
      }
      const o = (py * W + px) * 4;
      buf[o] = 128 + vx * 127; // R = x shift
      buf[o + 1] = 128 + vy * 127; // G = y shift
      buf[o + 2] = 128; // B unused
      buf[o + 3] = 255; // A opaque
    }
  }
  ctx.putImageData(img, 0, 0);
  // scale = the peak lateral displacement expressed in px (peak ratio × bezel).
  return { url: cv.toDataURL(), scale: peak * bezel };
}

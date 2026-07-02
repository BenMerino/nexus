// OUR physical glass model — the one the GPU lab proved (gpu-glass-form.ts:
// 4-norm squircle corners, cubic-eased C² bezel, Snell entry → flat back →
// Snell exit with TIR, then gap px to the backdrop) — baked into the
// displacement + Fresnel textures the backdrop-filter pipeline applies
// (kube-filter.ts). This is how glass reacts to SCROLLING CONTENT: the
// browser's backdrop-filter is the only primitive that can read the pixels
// behind an element, so the ray tracer's job here is to precompute the bend
// field, not to sample the scene. Replaces the vendored kube/ heuristic
// (1D profile × SDF direction) with the true 2D refraction field.

const IOR = 1.5, THICK = 24, GAP = 40;
// feDisplacementMap: offset = scale × (channel − 0.5) → ±24px at full range,
// matching the padded backdrop capture (kube-filter PAD) so the rim never
// pulls pixels the capture doesn't have.
export const DISP_SCALE = 48;

function sdRR(px: number, py: number, cx: number, cy: number,
  hx: number, hy: number, r: number): number {
  const qx = Math.abs(px - cx) - hx + r;
  const qy = Math.abs(py - cy) - hy + r;
  const mx = Math.max(qx, 0), my = Math.max(qy, 0);
  return (mx ** 4 + my ** 4) ** 0.25 + Math.min(Math.max(qx, qy), 0) - r;
}

function height(px: number, py: number, cx: number, cy: number,
  hx: number, hy: number, r: number, bezel: number): number {
  const e = -sdRR(px, py, cx, cy, hx, hy, r);
  if (e <= 0) return 0;
  const x = Math.min(e / bezel, 1);
  return bezel * (1 - (1 - x) ** 3);
}

// One texel's trace (element-local px): returns backdrop offset + Fresnel.
function trace(px: number, py: number, cx: number, cy: number,
  hx: number, hy: number, r: number, bezel: number,
): { dx: number; dy: number; f: number } {
  const eps = 1;
  const H = (x: number, y: number) => height(x, y, cx, cy, hx, hy, r, bezel);
  const gx = (H(px + eps, py) - H(px - eps, py)) / (2 * eps);
  const gy = (H(px, py + eps) - H(px, py - eps)) / (2 * eps);
  const inv = 1 / Math.hypot(gx, gy, 1);
  const nx = -gx * inv, ny = -gy * inv, nz = inv;

  // Snell entry, I = (0,0,-1): t1 = eta·I + (eta·nz − √k)·n
  const eta = 1 / IOR;
  const k1 = Math.max(0, 1 - eta * eta * (1 - nz * nz));
  const a = eta * nz - Math.sqrt(k1);
  const t1x = a * nx, t1y = a * ny, t1z = -eta + a * nz;
  const path = (THICK + H(px, py)) / Math.max(-t1z, 1e-4);
  let qx = px + t1x * path, qy = py + t1y * path;

  // Exit through the flat back face n=(0,0,1); TIR → internal reflection.
  const k2 = 1 - IOR * IOR * (1 - t1z * t1z);
  let t2x: number, t2y: number, t2z: number;
  if (k2 < 0) { t2x = t1x; t2y = t1y; t2z = -t1z; }
  else { t2x = IOR * t1x; t2y = IOR * t1y; t2z = -Math.sqrt(k2); }
  const travel = GAP / Math.max(Math.abs(t2z), 1e-4);
  qx += t2x * travel; qy += t2y * travel;

  // Schlick-Fresnel at the entry normal (rim highlight).
  const f0 = ((IOR - 1) / (IOR + 1)) ** 2;
  const f = f0 + (1 - f0) * (1 - Math.max(nz, 0)) ** 5;
  return { dx: qx - px, dy: qy - py, f };
}

export interface GlassMapOptions {
  w: number; h: number;         // element geometry (final px)
  texW: number; texH: number;   // texture resolution (capped by caller)
  radius: number; bezel: number;
}

// R/G encode x/y backdrop offset (neutral 128); the spec map is the Fresnel
// rim, screen-blended over the refraction by the filter chain.
export function generateGlassMaps(o: GlassMapOptions): { dispUrl: string; specUrl: string } | null {
  if (o.w <= 0 || o.h <= 0 || o.bezel <= 0) return null;
  const disp = document.createElement("canvas");
  const spec = document.createElement("canvas");
  disp.width = spec.width = o.texW; disp.height = spec.height = o.texH;
  const dctx = disp.getContext("2d"), sctx = spec.getContext("2d");
  if (!dctx || !sctx) return null;
  const di = dctx.createImageData(o.texW, o.texH), si = sctx.createImageData(o.texW, o.texH);

  const cx = o.w / 2, cy = o.h / 2;
  const r = Math.min(Math.max(o.radius, o.bezel), cx, cy);  // corner ≥ bezel (C²)
  const half = DISP_SCALE / 2;
  for (let ty = 0; ty < o.texH; ty++) {
    for (let tx = 0; tx < o.texW; tx++) {
      const i = (ty * o.texW + tx) * 4;
      const px = ((tx + 0.5) / o.texW) * o.w;
      const py = ((ty + 0.5) / o.texH) * o.h;
      if (sdRR(px, py, cx, cy, cx, cy, r) >= 0) {
        di[i] = di[i + 1] = di[i + 2] = 128; di[i + 3] = 255;
        si[i + 3] = 255;                     // black = no highlight
        continue;
      }
      const t = trace(px, py, cx, cy, cx, cy, r, o.bezel);
      const dx = Math.max(-half, Math.min(half, t.dx));
      const dy = Math.max(-half, Math.min(half, t.dy));
      di[i] = Math.round(128 + (dx / half) * 127);
      di[i + 1] = Math.round(128 + (dy / half) * 127);
      di[i + 2] = 128; di[i + 3] = 255;
      const s = Math.round(255 * Math.min(1, t.f * 0.85));
      si[i] = si[i + 1] = si[i + 2] = s; si[i + 3] = 255;
    }
  }
  dctx.putImageData(di, 0, 0);
  sctx.putImageData(si, 0, 0);
  return { dispUrl: disp.toDataURL("image/png"), specUrl: spec.toDataURL("image/png") };
}

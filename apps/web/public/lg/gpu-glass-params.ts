// Tunable parameters for the gpu-glass demo. Plain data: the panel
// (gpu-glass-panel.ts) mutates them through GlassControl.set and the mount
// (gpu-glass.ts) re-runs the render pass — every knob is a shader uniform.
export type GlassParams = {
  w: number; h: number;   // element size (CSS px)
  radius: number;         // corner radius (CSS px)
  bezel: number;          // rim quarter-circle radius (CSS px)
  thick: number;          // slab thickness (CSS px)
  dome: number;           // extra center curvature (CSS px) — 0 = flat top
  gap: number;            // slab → background distance (CSS px)
  ior: number;            // refractive index
  frost: number;          // 0..1 surface roughness (scatter blur)
  tint: string;           // glass color (#rrggbb); white = clear
  tintStrength: number;   // 0..1 Beer–Lambert weight
};

export type GlassControl = {
  params: GlassParams;
  set(patch: Partial<GlassParams>): void;
};

export function defaultGlassParams(radius: number): GlassParams {
  return { w: 480, h: 320, radius, bezel: 20, thick: 24, dome: 0, gap: 48,
    ior: 1.5, frost: 0, tint: "#e1e7f0", tintStrength: 1 };
}

// Beer–Lambert absorption per channel (CSS-px⁻¹): the glass absorbs the
// complement of its tint color, so a white tint absorbs nothing. The 0.06
// scale reproduces the original hardcoded cool-glass constants at the
// default tint (#e1e7f0, strength 1).
export function absorption(tint: string, strength: number): [number, number, number] {
  const n = parseInt(tint.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return c.map((v) => (1 - v / 255) * strength * 0.06) as [number, number, number];
}

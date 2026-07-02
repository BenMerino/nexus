// The GPU dashboard SCENE model (slice 1 of the native GPU renderer). "Full
// GPU" = the page content lives in a texture the glass can sample, so glass
// refracts EVERYTHING under it. This module is the retained data: a flat list
// of scene nodes (rects now; text/chart nodes in later slices), in PAGE
// coordinates (CSS px, pre-scroll). The scene renderer (gpu-scene-render.ts)
// rasterizes these into the scene texture each frame at the current scroll;
// the glass shader samples that texture.
export type RectNode = {
  kind: "rect";
  x: number; y: number; w: number; h: number;   // page px (pre-scroll)
  r: number;                                     // corner radius (px)
  color: [number, number, number, number];       // 0..1 rgba (fill)
};

// Future: | TextNode | ChartNode — same page-coord contract.
export type SceneNode = RectNode;

export type Scene = {
  nodes: SceneNode[];
  contentHeight: number;   // total scrollable page height (px)
};

// Pack rect nodes into the instance buffer layout the scene shader reads:
// 8 floats per rect — vec4(x,y,w,h) px, vec4(r, packedColor, _, _). Color is
// packed rgba8 into one float slot's bits via a Uint32 view alias.
export const RECT_STRIDE = 8;   // floats per instance

export function packRects(scene: Scene, dpr: number): Float32Array {
  const rects = scene.nodes.filter((n): n is RectNode => n.kind === "rect");
  const f = new Float32Array(rects.length * RECT_STRIDE);
  const u = new Uint32Array(f.buffer);
  for (let i = 0; i < rects.length; i++) {
    const n = rects[i];
    const o = i * RECT_STRIDE;
    f[o] = n.x * dpr; f[o + 1] = n.y * dpr;
    f[o + 2] = n.w * dpr; f[o + 3] = n.h * dpr;
    f[o + 4] = n.r * dpr;
    const [cr, cg, cb, ca] = n.color;
    u[o + 5] = (Math.round(ca * 255) << 24 | Math.round(cb * 255) << 16
      | Math.round(cg * 255) << 8 | Math.round(cr * 255)) >>> 0;
  }
  return f;
}

export function rectCount(scene: Scene): number {
  let n = 0;
  for (const node of scene.nodes) if (node.kind === "rect") n++;
  return n;
}

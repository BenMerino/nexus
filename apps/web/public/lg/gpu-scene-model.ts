// The GPU dashboard SCENE model (slice 1 of the native GPU renderer). "Full
// GPU" = the page content lives in a texture the glass can sample, so glass
// refracts EVERYTHING under it. This module is the retained data: a flat list
// of scene nodes (rects now; text/chart nodes in later slices), in PAGE
// coordinates (CSS px, pre-scroll). The scene renderer (gpu-scene-render.ts)
// rasterizes these into the scene texture each frame at the current scroll;
// the glass shader samples that texture.
// depth: the stacking rank of the glass host this node belongs to (0 =
// furthest back). A glass surface at depth D refracts only nodes with a
// SMALLER depth (strictly behind it), so it never refracts its own body/text.
export type RectNode = {
  kind: "rect";
  x: number; y: number; w: number; h: number;   // page px (pre-scroll)
  r: number;                                     // corner radius (px)
  color: [number, number, number, number];       // 0..1 rgba (fill)
  depth: number;
};

// A run of text on one baseline. Laid out to glyph quads by gpu-scene-text.ts.
export type TextNode = {
  kind: "text";
  text: string;
  x: number; y: number;          // page px; y = TOP of the line box
  size: number;                  // font px
  family: "sans" | "mono";
  color: [number, number, number, number];
  depth: number;
};

export type ChartNode = {
  kind: "poly";                  // a filled/stroked polyline (chart series)
  pts: number[];                 // flat x0,y0,x1,y1,… page px
  color: [number, number, number, number];
  width: number;                 // stroke px (0 = filled area to baselineY)
  baselineY: number;             // page px, for area fills
};

// A live <canvas>/<img> blitted into the scene (chart geometry canvases): the
// source is already GPU-rendered, so this is a cheap texture copy, NOT a DOM
// screenshot. Refracts like everything else.
export type ImageNode = {
  kind: "image";
  source: CanvasImageSource;     // the element to copyExternalImageToTexture
  x: number; y: number; w: number; h: number;   // page px
  depth: number;
};

export type SceneNode = RectNode | TextNode | ChartNode | ImageNode;

export type Scene = {
  nodes: SceneNode[];
  contentHeight: number;   // total scrollable page height (px)
};

// Pack rect nodes into the instance buffer layout the scene shader reads:
// 8 floats per rect — vec4(x,y,w,h) px, vec4(r, packedColor, _, _). Color is
// packed rgba8 into one float slot's bits via a Uint32 view alias.
export const RECT_STRIDE = 8;   // floats per instance

// maxDepth (optional): keep only nodes strictly BEHIND it (node.depth <
// maxDepth). Used so a glass surface refracts a scene without its own layer.
export function packRects(scene: Scene, dpr: number, maxDepth = Infinity): Float32Array {
  const rects = scene.nodes.filter((n): n is RectNode => n.kind === "rect" && n.depth < maxDepth);
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

export function rectCount(scene: Scene, maxDepth = Infinity): number {
  let n = 0;
  for (const node of scene.nodes) if (node.kind === "rect" && node.depth < maxDepth) n++;
  return n;
}

// Sorted distinct depths that a glass surface might refract against, PLUS the
// full-scene sentinel (Infinity) so chrome sampling gets everything.
export function distinctDepths(depthsUsed: number[]): number[] {
  return [...new Set(depthsUsed)].sort((a, b) => a - b);
}

function packColor(c: [number, number, number, number]): number {
  const u = new Uint32Array(1);
  u[0] = (Math.round(c[3] * 255) << 24 | Math.round(c[2] * 255) << 16
    | Math.round(c[1] * 255) << 8 | Math.round(c[0] * 255)) >>> 0;
  return new Float32Array(u.buffer)[0];
}

export function polySegCount(scene: Scene): number {
  let n = 0;
  for (const node of scene.nodes)
    if (node.kind === "poly") n += Math.max(0, node.pts.length / 2 - 1);
  return n;
}

// Expand each polyline into per-segment instances: 8 floats — (x0,y0,x1,y1)
// page px, (halfWidth, packedColor, _, _). One segment per adjacent point pair.
export function packPolys(scene: Scene, dpr: number): Float32Array {
  const polys = scene.nodes.filter((n): n is ChartNode => n.kind === "poly");
  const out: number[] = [];
  for (const p of polys) {
    const col = packColor(p.color);
    const hw = Math.max(p.width, 1) * 0.5 * dpr;
    for (let i = 0; i + 3 < p.pts.length; i += 2) {
      out.push(p.pts[i] * dpr, p.pts[i + 1] * dpr, p.pts[i + 2] * dpr, p.pts[i + 3] * dpr,
        hw, col, 0, 0);
    }
  }
  return new Float32Array(out);
}

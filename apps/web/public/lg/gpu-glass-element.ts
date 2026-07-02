// One glass surface = one WebGPU canvas INSIDE its element (.gpu-glass-layer:
// absolute, inset 0, z:-1 — the same layer slot the CSS liquid ::before
// uses). The element OWNS its glass and its content: no rect-tracking against
// a fullscreen canvas, no stacking gymnastics — scrolling, occlusion and
// nesting come from the DOM itself. Only the SKY SAMPLE needs the element's
// viewport offset (refraction bends the global sky), refreshed each redraw.
import { absorption } from "./gpu-glass-params";
import { cornerRadius } from "./gpu-glass-surfaces";

// Chrome material — thinner than the lab slab (chrome is thin glass).
const MAT = { ior: 1.5, dispersion: 0.008, bezel: 12, thick: 14, gap: 40,
  frost: 0, tint: "#e1e7f0", tintStrength: 1 };

export type Shared = {
  device: GPUDevice;
  pipeline: GPURenderPipeline;
  configure: (ctx: GPUCanvasContext) => void;
};

export type Surface = {
  el: HTMLElement;
  canvas: HTMLCanvasElement;
  ctx: GPUCanvasContext;
  ubuf: GPUBuffer;
  bind: GPUBindGroup;
};

// Per-frame globals, computed once by the orchestrator (gpu-glass-page.ts).
export type Frame = {
  dpr: number; vw: number; vh: number;      // viewport, device px
  top: number[]; hor: number[];             // sky colors 0..1
  ceil: number; glow: number;               // HDR ceiling + glow intensity
};

export function attachSurface(sh: Shared, el: HTMLElement): Surface | null {
  const canvas = document.createElement("canvas");
  canvas.className = "gpu-glass-layer";
  const ctx = canvas.getContext("webgpu");
  if (!ctx) return null;
  try { sh.configure(ctx); } catch { return null; }
  el.prepend(canvas);
  const ubuf = sh.device.createBuffer({
    size: 96, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const bind = sh.device.createBindGroup({
    layout: sh.pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: ubuf } }],
  });
  return { el, canvas, ctx, ubuf, bind };
}

export function detachSurface(s: Surface): void {
  s.canvas.remove();
  s.ubuf.destroy();
}

// Encode one surface's render pass; returns false when there is nothing to
// draw (hidden or fully offscreen — the canvas scrolls with its element, so
// stale pixels offscreen are still correct pixels when they come back).
export function drawSurface(sh: Shared, s: Surface, enc: GPUCommandEncoder, f: Frame): boolean {
  const b = s.el.getBoundingClientRect();
  if (b.width < 24 || b.height < 24) return false;
  if (b.bottom < 0 || b.top > innerHeight || b.right < 0 || b.left > innerWidth) return false;

  const w = Math.max(1, Math.round(b.width * f.dpr));
  const h = Math.max(1, Math.round(b.height * f.dpr));
  if (s.canvas.width !== w) s.canvas.width = w;
  if (s.canvas.height !== h) s.canvas.height = h;

  // Corner ≥ bezel: a rim roll can't wrap a tighter corner without a crease.
  const r = Math.min(Math.max(cornerRadius(s.el), MAT.bezel), b.width / 2, b.height / 2);
  const k = absorption(MAT.tint, MAT.tintStrength);
  sh.device.queue.writeBuffer(s.ubuf, 0, new Float32Array([
    w, h, b.left * f.dpr, b.top * f.dpr,
    f.vw, f.vh, MAT.gap * f.dpr, MAT.ior,
    r * f.dpr, MAT.bezel * f.dpr, MAT.thick * f.dpr, MAT.dispersion,
    f.top[0], f.top[1], f.top[2], f.ceil,
    f.hor[0], f.hor[1], f.hor[2], f.glow,
    k[0] / f.dpr, k[1] / f.dpr, k[2] / f.dpr, MAT.frost * 32 * f.dpr,
  ]));
  const pass = enc.beginRenderPass({
    colorAttachments: [{
      view: s.ctx.getCurrentTexture().createView(),
      clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: "clear", storeOp: "store",
    }],
  });
  pass.setPipeline(sh.pipeline);
  pass.setBindGroup(0, s.bind);
  pass.draw(3);
  pass.end();
  return true;
}

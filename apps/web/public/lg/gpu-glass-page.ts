// GPU liquid glass for APP PAGES (route-scoped — see spa/GlassGpuMode.tsx):
// the chrome surfaces render as physically ray-traced slabs
// (gpu-glass-multi.ts) instead of CSS glass. TWO fullscreen transparent
// canvases bracket the content:
//  · content layer (z:0, above #sky-bg, below the app) — cards/panels/kpis;
//  · chrome layer (z:30, above scrolled content, below the header z:40 /
//    sidebar z:35 text) — so cards physically slide UNDER the header glass.
// Redraws are on-demand (scroll/resize/mutations/sky events), rAF-coalesced;
// slab rects come straight from the live DOM each draw.
import { skyFor } from "../sky/sky-palette";
import { getSkyMode, forcedAltitude } from "../sky/sky-mode";
import { displayHeadroom } from "../sky/sky-gpu";
import { MULTI_GLASS_SHADER } from "./gpu-glass-multi";
import { absorption } from "./gpu-glass-params";
import { collectSlabs, CHROME_HOSTS, CONTENT_HOSTS, MAX_SLABS } from "./gpu-glass-surfaces";

// Chrome material — thinner than the lab slab (chrome is thin glass).
const MAT = { ior: 1.5, dispersion: 0.008, bezel: 12, thick: 14, gap: 40,
  frost: 0, tint: "#e1e7f0", tintStrength: 1 };

function mkCanvas(z: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  Object.assign(c.style, { position: "fixed", inset: "0", width: "100%",
    height: "100%", zIndex: z, pointerEvents: "none", display: "block" });
  return c;
}

export async function mountGpuGlassPage(): Promise<(() => void) | false> {
  if (!navigator.gpu) return false;
  let device: GPUDevice;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return false;
    device = await adapter.requestDevice();
  } catch { return false; }

  const layers = [
    { hosts: CONTENT_HOSTS, canvas: mkCanvas("0") },
    { hosts: CHROME_HOSTS, canvas: mkCanvas("30") },
  ].map((l) => ({
    ...l,
    ctx: l.canvas.getContext("webgpu"),
    ubuf: device.createBuffer({ size: 80, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }),
    sbuf: device.createBuffer({ size: MAX_SLABS * 32, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST }),
    slabs: new Float32Array(MAX_SLABS * 8),
  }));
  if (layers.some((l) => !l.ctx)) return false;

  // Same precision dance as the lab page: float16/P3/extended when available.
  let format: GPUTextureFormat = "rgba16float";
  let hdr = false;
  try {
    for (const l of layers)
      l.ctx!.configure({ device, format, colorSpace: "display-p3", alphaMode: "premultiplied",
        toneMapping: { mode: "extended" } } as GPUCanvasConfiguration);
    hdr = displayHeadroom() > 1;
  } catch {
    format = navigator.gpu.getPreferredCanvasFormat();
    try {
      for (const l of layers) l.ctx!.configure({ device, format, alphaMode: "premultiplied" });
    } catch { return false; }
  }

  const mod = device.createShaderModule({ code: MULTI_GLASS_SHADER });
  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: { module: mod, entryPoint: "vs" },
    fragment: { module: mod, entryPoint: "fs", targets: [{ format }] },
    primitive: { topology: "triangle-list" },
  });
  const binds = layers.map((l) => device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: l.ubuf } },
      { binding: 1, resource: { buffer: l.sbuf } },
    ],
  }));

  // Content glass right above #sky-bg (both z:0 — DOM order layers them);
  // chrome glass appended last at z:30.
  const sky = document.getElementById("sky-bg");
  if (sky) sky.after(layers[0].canvas); else document.body.prepend(layers[0].canvas);
  document.body.appendChild(layers[1].canvas);

  const draw = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr);
    const alt = forcedAltitude(getSkyMode());
    const skyC = skyFor(alt);
    const gold = Math.max(0, Math.min(1, 1 - Math.abs(alt) / 8));
    const ceil = hdr ? displayHeadroom() : 1.0;
    const c = (v: number[]) => v.map((x) => x / 255);
    const [tr, tg, tb] = c(skyC.top), [hr, hg, hb] = c(skyC.hor);
    const k = absorption(MAT.tint, MAT.tintStrength);
    const cmd = device.createCommandEncoder();
    for (let i = 0; i < layers.length; i++) {
      const L = layers[i];
      if (L.canvas.width !== w) L.canvas.width = w;
      if (L.canvas.height !== h) L.canvas.height = h;
      const count = collectSlabs(L.hosts, dpr, L.slabs, MAT.bezel);
      if (count > 0) device.queue.writeBuffer(L.sbuf, 0, L.slabs, 0, count * 8);
      device.queue.writeBuffer(L.ubuf, 0, new Float32Array([
        w, h, MAT.gap * dpr, MAT.ior,
        MAT.bezel * dpr, MAT.thick * dpr, MAT.dispersion, count,
        tr, tg, tb, ceil,
        hr, hg, hb, 1.0 + gold * (ceil - 1.0),
        k[0] / dpr, k[1] / dpr, k[2] / dpr, MAT.frost * 32 * dpr,
      ]));
      const pass = cmd.beginRenderPass({
        colorAttachments: [{
          view: L.ctx!.getCurrentTexture().createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: "clear", storeOp: "store",
        }],
      });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, binds[i]);
      pass.draw(3);
      pass.end();
    }
    device.queue.submit([cmd.finish()]);
  };

  // rAF-coalesced redraw: rects move on scroll, surfaces mount on data.
  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; draw(); });
  };
  const mo = new MutationObserver(schedule);
  mo.observe(document.body, { childList: true, subtree: true, attributes: true,
    attributeFilter: ["style", "class"] });
  document.addEventListener("scroll", schedule, { capture: true, passive: true });
  window.addEventListener("resize", schedule);
  window.addEventListener("nexus:sky-mode", schedule);
  window.addEventListener("nexus:theme-tokens", schedule);
  document.fonts?.ready.then(schedule);

  draw();
  return () => {
    mo.disconnect();
    document.removeEventListener("scroll", schedule, { capture: true } as EventListenerOptions);
    window.removeEventListener("resize", schedule);
    window.removeEventListener("nexus:sky-mode", schedule);
    window.removeEventListener("nexus:theme-tokens", schedule);
    for (const l of layers) l.canvas.remove();
    device.destroy();
  };
}

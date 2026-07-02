// Physically-based glass element on WebGPU (glass-gpu.html). The canvas is
// TRANSPARENT outside the slab — the page's already-running #sky-bg engine is
// the one and only background. Inside the slab the optics are ray-traced from
// the element's geometry (gpu-glass-shader.ts): Snell entry/exit, TIR,
// Beer–Lambert, Fresnel — sampling SKY_WGSL (the engine's own exported
// function) so the bent image agrees with the live background behind the
// canvas. Draggable: the element is a uniform, so dragging re-runs the pass.
import { skyFor } from "../sky/sky-palette";
import { getSkyMode, forcedAltitude } from "../sky/sky-mode";
import { displayHeadroom } from "../sky/sky-gpu";
import { GLASS_SHADER } from "./gpu-glass-shader";
import { defaultGlassParams, absorption } from "./gpu-glass-params";
import type { GlassControl } from "./gpu-glass-params";

export async function mountGpuGlass(
  canvas: HTMLCanvasElement, follower?: HTMLElement,
): Promise<GlassControl | false> {
  if (!navigator.gpu) return false;
  let device: GPUDevice;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return false;
    device = await adapter.requestDevice();
  } catch { return false; }
  const ctx = canvas.getContext("webgpu");
  if (!ctx) return false;

  // Match the background engine's canvas (float16 / display-p3 / extended) so
  // the refracted samples share its precision; premultiplied alpha so the
  // outside-the-slab area is truly transparent over the live sky.
  let format: GPUTextureFormat = "rgba16float";
  let hdr = false;
  try {
    ctx.configure({ device, format, colorSpace: "display-p3", alphaMode: "premultiplied",
      toneMapping: { mode: "extended" } } as GPUCanvasConfiguration);
    hdr = displayHeadroom() > 1;
  } catch {
    format = navigator.gpu.getPreferredCanvasFormat();
    try { ctx.configure({ device, format, alphaMode: "premultiplied" }); } catch { return false; }
  }

  const mod = device.createShaderModule({ code: GLASS_SHADER });
  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: { module: mod, entryPoint: "vs" },
    fragment: { module: mod, entryPoint: "fs", targets: [{ format }] },
    primitive: { topology: "triangle-list" },
  });
  const ubuf = device.createBuffer({ size: 112, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const bind = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: ubuf } }],
  });

  // Corner radius defaults to OUR token (--radius-card) — platform geometry.
  const radiusCss = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue("--radius-card"),
  ) || 18;
  const P = defaultGlassParams(radiusCss);

  let cx = innerWidth / 2, cy = innerHeight / 2;   // element center (CSS px)

  const draw = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
    const alt = forcedAltitude(getSkyMode());
    const sky = skyFor(alt);
    // Same glow parameters the live engine is painted with (sky-bg.ts).
    const gold = Math.max(0, Math.min(1, 1 - Math.abs(alt) / 8));
    const ceil = hdr ? displayHeadroom() : 1.0;
    const glowHDR = 1.0 + gold * (ceil - 1.0);
    const c = (v: number[]) => v.map((x) => x / 255);
    const [tr, tg, tb] = c(sky.top), [hr, hg, hb] = c(sky.hor);
    const k = absorption(P.tint, P.tintStrength);        // CSS-px⁻¹ → /dpr below
    const lim = Math.min(P.w, P.h) / 2;                  // keep SDF radii valid
    const bez = Math.min(P.bezel, lim);
    // corner ≥ bezel: the rim roll can't wrap a tighter corner without a
    // curvature crease (real slabs obey this too) — the corner grows to fit.
    const rad = Math.min(Math.max(P.radius, bez), lim);
    device.queue.writeBuffer(ubuf, 0, new Float32Array([
      canvas.width, canvas.height, P.gap * dpr, P.ior,
      cx * dpr, cy * dpr, (P.w / 2) * dpr, (P.h / 2) * dpr,
      rad * dpr, bez * dpr, P.thick * dpr, 0.5,
      tr, tg, tb, ceil,                                  // top.a = HDR ceiling
      hr, hg, hb, glowHDR,                               // hor.a = glow intensity
      24 * dpr, 0.22, 0.5 * dpr, P.dome * dpr,           // grid …, d.w = dome
      k[0] / dpr, k[1] / dpr, k[2] / dpr, P.frost * 32 * dpr,
    ]));
    const cmd = device.createCommandEncoder();
    const pass = cmd.beginRenderPass({
      colorAttachments: [{
        view: ctx.getCurrentTexture().createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: "clear", storeOp: "store",
      }],
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bind);
    pass.draw(3);
    pass.end();
    device.queue.submit([cmd.finish()]);
    if (follower) {
      follower.style.left = `${cx}px`;
      follower.style.top = `${cy}px`;
      follower.style.width = `${Math.max(P.w - 48, 48)}px`;
    }
  };

  // ── Drag: the element is just a uniform — move the center, re-run the pass.
  const inside = (x: number, y: number) =>
    Math.abs(x - cx) <= P.w / 2 && Math.abs(y - cy) <= P.h / 2;
  let grab: { dx: number; dy: number } | null = null;
  canvas.addEventListener("pointerdown", (e) => {
    if (!inside(e.clientX, e.clientY)) return;
    grab = { dx: e.clientX - cx, dy: e.clientY - cy };
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = "grabbing";
  });
  canvas.addEventListener("pointermove", (e) => {
    if (grab) { cx = e.clientX - grab.dx; cy = e.clientY - grab.dy; draw(); return; }
    canvas.style.cursor = inside(e.clientX, e.clientY) ? "grab" : "default";
  });
  const drop = (e: PointerEvent) => {
    grab = null;
    canvas.style.cursor = inside(e.clientX, e.clientY) ? "grab" : "default";
  };
  canvas.addEventListener("pointerup", drop);
  canvas.addEventListener("pointercancel", drop);

  draw();
  window.addEventListener("resize", draw);
  window.addEventListener("nexus:sky-mode", draw);
  return { params: P, set: (patch) => { Object.assign(P, patch); draw(); } };
}

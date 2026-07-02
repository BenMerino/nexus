// Physically-based glass element on WebGPU (glass-gpu.html). The whole scene
// is ONE fullscreen pass (gpu-glass-shader.ts): our real dark-sky gradient
// (same palette module as the live #sky-bg) plus a glass slab whose optics are
// ray-traced from its geometry — Snell entry/exit, TIR, Beer–Lambert, Fresnel.
// No SVG filters, no displacement textures, no backdrop-filter: the bending is
// computed, not painted. Falls back to a plain message without WebGPU.
import { skyFor } from "../sky/sky-palette";
import { getSkyMode, forcedAltitude } from "../sky/sky-mode";
import { GLASS_SHADER } from "./gpu-glass-shader";

const IOR = 1.5;          // crown glass
const THICK = 24;         // slab thickness (CSS px)
const GAP = 48;           // slab → background distance (CSS px)
const BEZEL = 20;         // rim quarter-circle radius (CSS px)
const EL_W = 480, EL_H = 320;

export async function mountGpuGlass(canvas: HTMLCanvasElement): Promise<boolean> {
  if (!navigator.gpu) return false;
  let device: GPUDevice;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return false;
    device = await adapter.requestDevice();
  } catch { return false; }
  const ctx = canvas.getContext("webgpu");
  if (!ctx) return false;
  const format = navigator.gpu.getPreferredCanvasFormat();
  ctx.configure({ device, format, alphaMode: "opaque" });

  const mod = device.createShaderModule({ code: GLASS_SHADER });
  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: { module: mod, entryPoint: "vs" },
    fragment: { module: mod, entryPoint: "fs", targets: [{ format }] },
    primitive: { topology: "triangle-list" },
  });
  const ubuf = device.createBuffer({ size: 80, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const bind = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: ubuf } }],
  });

  // The element's corner radius comes from OUR token (--radius-card), so the
  // form matches the platform's card geometry.
  const radiusCss = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue("--radius-card"),
  ) || 18;

  const draw = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
    const sky = skyFor(forcedAltitude(getSkyMode()));
    const c = (v: number[]) => v.map((x) => x / 255);
    const [tr, tg, tb] = c(sky.top), [hr, hg, hb] = c(sky.hor);
    device.queue.writeBuffer(ubuf, 0, new Float32Array([
      canvas.width, canvas.height, GAP * dpr, IOR,
      canvas.width / 2, canvas.height / 2, (EL_W / 2) * dpr, (EL_H / 2) * dpr,
      radiusCss * dpr, BEZEL * dpr, THICK * dpr, 0,
      tr, tg, tb, 0,
      hr, hg, hb, 0,
    ]));
    const cmd = device.createCommandEncoder();
    const pass = cmd.beginRenderPass({
      colorAttachments: [{
        view: ctx.getCurrentTexture().createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 1 }, loadOp: "clear", storeOp: "store",
      }],
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bind);
    pass.draw(3);
    pass.end();
    device.queue.submit([cmd.finish()]);
  };

  draw();
  window.addEventListener("resize", draw);
  window.addEventListener("nexus:sky-mode", draw);
  return true;
}

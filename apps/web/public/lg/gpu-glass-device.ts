// GPU bootstrap for the page glass engine (split from gpu-glass-page.ts to
// keep it under the 150-line cap): request the device, decide the canvas
// format once on a probe context (all element canvases must share it), build
// the element-glass pipeline, sampler and fallback texture. Returns the Shared
// bundle every surface draws with, or null if WebGPU is unavailable.
import { displayHeadroom } from "../sky/sky-gpu";
import { ELEMENT_GLASS_SHADER } from "./gpu-glass-element-shader";
import type { Shared } from "./gpu-glass-element";

export type Boot = { device: GPUDevice; sh: Shared; hdr: boolean };

export async function bootGlassDevice(): Promise<Boot | null> {
  if (!navigator.gpu) return null;
  let device: GPUDevice;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return null;
    device = await adapter.requestDevice();
  } catch { return null; }

  let format: GPUTextureFormat = "rgba16float";
  let extended = true;
  const probe = document.createElement("canvas").getContext("webgpu");
  if (!probe) return null;
  const configure = (ctx: GPUCanvasContext) => {
    if (extended) {
      ctx.configure({ device, format, colorSpace: "display-p3", alphaMode: "premultiplied",
        toneMapping: { mode: "extended" } } as GPUCanvasConfiguration);
    } else {
      ctx.configure({ device, format, alphaMode: "premultiplied" });
    }
  };
  try { configure(probe); } catch {
    extended = false;
    format = navigator.gpu.getPreferredCanvasFormat();
    try { configure(probe); } catch { return null; }
  }
  const hdr = extended && displayHeadroom() > 1;

  const mod = device.createShaderModule({ code: ELEMENT_GLASS_SHADER });
  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: { module: mod, entryPoint: "vs" },
    fragment: { module: mod, entryPoint: "fs", targets: [{ format }] },
    primitive: { topology: "triangle-list" },
  });
  const sampler = device.createSampler({ magFilter: "linear", minFilter: "linear" });
  const fallbackTex = device.createTexture({
    size: [1, 1], format: "rgba8unorm",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
  device.queue.writeTexture({ texture: fallbackTex }, new Uint8Array([0, 0, 0, 0]),
    { bytesPerRow: 4 }, [1, 1]);

  return { device, hdr, sh: { device, pipeline, configure, sampler, fallbackTex } };
}

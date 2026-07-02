// Blit live <canvas> nodes (chart geometry canvases) into the scene texture.
// The source is already GPU-rendered, so each is a cheap copyExternalImageToTexture
// into a per-node texture, then a textured quad — NOT a DOM screenshot. Textures
// are pooled by node identity so we reallocate only on size change. This lets
// charts refract through the glass like every other scene layer.
import { IMAGE_SHADER } from "./gpu-scene-image-shader";
import type { ImageNode } from "./gpu-scene-model";

type Slot = { tex: GPUTexture; w: number; h: number; bind: GPUBindGroup; ubuf: GPUBuffer };

export type ImagePass = {
  // Upload BEFORE the render pass (queue copies must land before the pass
  // samples the textures); draw DURING the pass.
  upload: (nodes: ImageNode[], scrollY: number, vw: number, vh: number, dpr: number) => void;
  draw: (pass: GPURenderPassEncoder, nodes: ImageNode[]) => void;
  destroy: () => void;
};

export function createImagePass(device: GPUDevice): ImagePass {
  const mod = device.createShaderModule({ code: IMAGE_SHADER });
  const pipeline = device.createRenderPipeline({
    layout: "auto", vertex: { module: mod, entryPoint: "vs" },
    fragment: { module: mod, entryPoint: "fs", targets: [{ format: "rgba16float", blend: {
      color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
      alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" } } }] },
    primitive: { topology: "triangle-list" },
  });
  const samp = device.createSampler({ magFilter: "linear", minFilter: "linear" });
  const slots = new WeakMap<CanvasImageSource, Slot>();

  // Each node owns its uniform buffer so the per-node position survives to draw
  // time (one shared buffer would be clobbered — all draws see the last write).
  const slotFor = (n: ImageNode, dpr: number): Slot | null => {
    const w = Math.max(1, Math.round(n.w * dpr)), h = Math.max(1, Math.round(n.h * dpr));
    let s = slots.get(n.source);
    if (!s || s.w !== w || s.h !== h) {
      s?.tex.destroy();
      const tex = device.createTexture({ size: [w, h], format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT });
      const ubuf = s?.ubuf ?? device.createBuffer({ size: 32,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      const bind = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [
        { binding: 0, resource: { buffer: ubuf } },
        { binding: 1, resource: tex.createView() }, { binding: 2, resource: samp }] });
      s = { tex, w, h, bind, ubuf };
      slots.set(n.source, s);
    }
    return s;
  };

  return {
    upload(nodes, scrollY, vw, vh, dpr) {
      for (const n of nodes) {
        const s = slotFor(n, dpr);
        if (!s) continue;
        try {
          device.queue.copyExternalImageToTexture({ source: n.source, flipY: false },
            { texture: s.tex }, [s.w, s.h]);
        } catch { continue; }   // tainted / zero-size source: skip this frame
        device.queue.writeBuffer(s.ubuf, 0, new Float32Array([
          n.x * dpr, (n.y - scrollY) * dpr, n.w * dpr, n.h * dpr, vw, vh, 0, 0]));
      }
    },
    draw(pass, nodes) {
      for (const n of nodes) {
        const s = slots.get(n.source);
        if (!s) continue;
        pass.setPipeline(pipeline); pass.setBindGroup(0, s.bind); pass.draw(6);
      }
    },
    destroy() { /* slot textures/buffers GC with the WeakMap */ },
  };
}

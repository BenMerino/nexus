// The SCENE renderer: owns the offscreen texture and, each frame, draws sky →
// card rects → chart polys → text into it at the current scroll. The glass
// samples THIS texture, so glass refracts EVERYTHING under it (surfaces, chart
// strokes, and real text) at 60fps with no DOM capture. Content nodes are read
// from the live DOM each frame (gpu-scene-dom.ts) at their true positions — a
// glass element over content refracts it naturally, no scroll hacks.
import { packRects, rectCount, type Scene } from "./gpu-scene-model";
import { layoutText, glyphCount } from "./gpu-scene-text";
import { buildGlyphAtlas, uploadAtlas } from "./gpu-glyph-atlas";
import type { Atlas } from "./gpu-glyph-atlas";
import { buildScenePipes, FORMAT } from "./gpu-scene-pipelines";
import { createImagePass } from "./gpu-scene-image";
import type { ImageNode } from "./gpu-scene-model";

export type SkyFrame = { top: number[]; hor: number[]; ceil: number; glow: number };
export type SceneRenderer = {
  width: number; height: number;
  // Render the scene keeping only nodes strictly behind maxDepth, into the
  // depth's pooled texture; returns it. Call once per distinct depth a glass
  // surface samples; Infinity = full scene (for chrome).
  renderLayer: (scene: Scene, scrollY: number, sky: SkyFrame, dpr: number, maxDepth: number) => GPUTexture;
  resize: (w: number, h: number) => void;
  destroy: () => void;
};

const MAX_RECTS = 512, MAX_GLYPHS = 16384;

export function createSceneRenderer(device: GPUDevice, w: number, h: number): SceneRenderer {
  const pipes = buildScenePipes(device);
  const imagePass = createImagePass(device);
  const atlas: Atlas = buildGlyphAtlas();
  const atlasTex = uploadAtlas(device, atlas);
  const samp = device.createSampler({ magFilter: "linear", minFilter: "linear" });

  const ubuf = device.createBuffer({ size: 48, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const rbuf = device.createBuffer({ size: MAX_RECTS * 32, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  const gbuf = device.createBuffer({ size: MAX_GLYPHS * 48, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  const skyBind = device.createBindGroup({ layout: pipes.sky.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: ubuf } }] });
  const rectBind = device.createBindGroup({ layout: pipes.rect.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: ubuf } }, { binding: 1, resource: { buffer: rbuf } }] });
  const textBind = device.createBindGroup({ layout: pipes.text.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: ubuf } }, { binding: 1, resource: { buffer: gbuf } },
      { binding: 2, resource: atlasTex.createView() }, { binding: 3, resource: samp }] });

  const make = (tw: number, th: number) => device.createTexture({
    size: [Math.max(1, tw), Math.max(1, th)], format: FORMAT,
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });

  // One pooled texture per distinct depth requested this frame (reused across
  // frames; freed on resize).
  const pool = new Map<number, GPUTexture>();
  const texFor = (depth: number): GPUTexture => {
    let t = pool.get(depth);
    if (!t) { t = make(r.width, r.height); pool.set(depth, t); }
    return t;
  };

  const r: SceneRenderer = {
    width: w, height: h,
    resize(nw, nh) {
      if (nw === r.width && nh === r.height) return;
      for (const t of pool.values()) t.destroy();
      pool.clear(); r.width = nw; r.height = nh;
    },
    renderLayer(scene, scrollY, sky, dpr, maxDepth) {
      const target = texFor(maxDepth);
      const nR = Math.min(rectCount(scene, maxDepth), MAX_RECTS);
      if (nR > 0) device.queue.writeBuffer(rbuf, 0, packRects(scene, dpr, maxDepth).subarray(0, nR * 8));
      const glyphs = layoutText(scene, atlas, dpr, maxDepth);
      const nG = Math.min(glyphCount(glyphs), MAX_GLYPHS);
      if (nG > 0) device.queue.writeBuffer(gbuf, 0, glyphs.subarray(0, nG * 12));
      device.queue.writeBuffer(ubuf, 0, new Float32Array([
        r.width, r.height, scrollY, nR,
        sky.top[0], sky.top[1], sky.top[2], sky.ceil,
        sky.hor[0], sky.hor[1], sky.hor[2], sky.glow,
      ]));
      // Chart canvases strictly behind this layer; upload BEFORE the pass.
      const images = scene.nodes.filter((n): n is ImageNode => n.kind === "image" && n.depth < maxDepth);
      if (images.length) imagePass.upload(images, scrollY / dpr, r.width, r.height, dpr);
      const enc = device.createCommandEncoder();
      const pass = enc.beginRenderPass({ colorAttachments: [{
        view: target.createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 1 }, loadOp: "clear", storeOp: "store" }] });
      pass.setPipeline(pipes.sky); pass.setBindGroup(0, skyBind); pass.draw(3);
      if (nR > 0) { pass.setPipeline(pipes.rect); pass.setBindGroup(0, rectBind); pass.draw(6, nR); }
      if (images.length) imagePass.draw(pass, images);
      if (nG > 0) { pass.setPipeline(pipes.text); pass.setBindGroup(0, textBind); pass.draw(6, nG); }
      pass.end();
      device.queue.submit([enc.finish()]);
      return target;
    },
    destroy() { for (const t of pool.values()) t.destroy();
      ubuf.destroy(); rbuf.destroy(); gbuf.destroy(); atlasTex.destroy(); },
  };
  return r;
}

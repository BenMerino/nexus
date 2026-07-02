// The SCENE renderer: owns the offscreen texture and, each frame, draws sky →
// card rects → chart polys → text into it at the current scroll. The glass
// samples THIS texture, so glass refracts EVERYTHING under it (surfaces, chart
// strokes, and real text) at 60fps with no DOM capture. Content nodes are read
// from the live DOM each frame (gpu-scene-dom.ts) at their true positions — a
// glass element over content refracts it naturally, no scroll hacks.
import { packRects, rectCount, packPolys, polySegCount, type Scene } from "./gpu-scene-model";
import { layoutText, glyphCount } from "./gpu-scene-text";
import { buildGlyphAtlas, uploadAtlas } from "./gpu-glyph-atlas";
import type { Atlas } from "./gpu-glyph-atlas";
import { buildScenePipes, FORMAT } from "./gpu-scene-pipelines";

export type SkyFrame = { top: number[]; hor: number[]; ceil: number; glow: number };
export type SceneRenderer = {
  texture: GPUTexture; width: number; height: number;
  render: (scene: Scene, scrollY: number, sky: SkyFrame, dpr: number) => void;
  resize: (w: number, h: number) => void;
  destroy: () => void;
};

const MAX_RECTS = 512, MAX_SEGS = 8192, MAX_GLYPHS = 16384;

export function createSceneRenderer(device: GPUDevice, w: number, h: number): SceneRenderer {
  const pipes = buildScenePipes(device);
  const atlas: Atlas = buildGlyphAtlas();
  const atlasTex = uploadAtlas(device, atlas);
  const samp = device.createSampler({ magFilter: "linear", minFilter: "linear" });

  const ubuf = device.createBuffer({ size: 48, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const rbuf = device.createBuffer({ size: MAX_RECTS * 32, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  const pbuf = device.createBuffer({ size: MAX_SEGS * 32, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  const gbuf = device.createBuffer({ size: MAX_GLYPHS * 48, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  const u = (p: GPURenderPipeline) => device.createBindGroup({ layout: p.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: ubuf } }] });
  const skyBind = u(pipes.sky);
  const rectBind = device.createBindGroup({ layout: pipes.rect.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: ubuf } }, { binding: 1, resource: { buffer: rbuf } }] });
  const polyBind = device.createBindGroup({ layout: pipes.poly.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: ubuf } }, { binding: 1, resource: { buffer: pbuf } }] });
  const textBind = device.createBindGroup({ layout: pipes.text.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: ubuf } }, { binding: 1, resource: { buffer: gbuf } },
      { binding: 2, resource: atlasTex.createView() }, { binding: 3, resource: samp }] });

  const make = (tw: number, th: number) => device.createTexture({
    size: [Math.max(1, tw), Math.max(1, th)], format: FORMAT,
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });

  const r: SceneRenderer = {
    texture: make(w, h), width: w, height: h,
    resize(nw, nh) {
      if (nw === r.width && nh === r.height) return;
      r.texture.destroy(); r.texture = make(nw, nh); r.width = nw; r.height = nh;
    },
    render(scene, scrollY, sky, dpr) {
      const nR = Math.min(rectCount(scene), MAX_RECTS);
      if (nR > 0) device.queue.writeBuffer(rbuf, 0, packRects(scene, dpr).subarray(0, nR * 8));
      const polys = packPolys(scene, dpr);
      const nP = Math.min(polySegCount(scene), MAX_SEGS);
      if (nP > 0) device.queue.writeBuffer(pbuf, 0, polys.subarray(0, nP * 8));
      const glyphs = layoutText(scene, atlas, dpr);
      const nG = Math.min(glyphCount(glyphs), MAX_GLYPHS);
      if (nG > 0) device.queue.writeBuffer(gbuf, 0, glyphs.subarray(0, nG * 12));
      device.queue.writeBuffer(ubuf, 0, new Float32Array([
        r.width, r.height, scrollY, nR,
        sky.top[0], sky.top[1], sky.top[2], sky.ceil,
        sky.hor[0], sky.hor[1], sky.hor[2], sky.glow,
      ]));
      const enc = device.createCommandEncoder();
      const pass = enc.beginRenderPass({ colorAttachments: [{
        view: r.texture.createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 1 }, loadOp: "clear", storeOp: "store" }] });
      pass.setPipeline(pipes.sky); pass.setBindGroup(0, skyBind); pass.draw(3);
      if (nR > 0) { pass.setPipeline(pipes.rect); pass.setBindGroup(0, rectBind); pass.draw(6, nR); }
      if (nP > 0) { pass.setPipeline(pipes.poly); pass.setBindGroup(0, polyBind); pass.draw(6, nP); }
      if (nG > 0) { pass.setPipeline(pipes.text); pass.setBindGroup(0, textBind); pass.draw(6, nG); }
      pass.end();
      device.queue.submit([enc.finish()]);
    },
    destroy() { r.texture.destroy(); ubuf.destroy(); rbuf.destroy(); pbuf.destroy();
      gbuf.destroy(); atlasTex.destroy(); },
  };
  return r;
}

// The SCENE renderer: owns an offscreen texture and, each frame, draws the sky
// then every card rect into it at the current scroll (gpu-scene-shader.ts).
// The glass surfaces sample THIS texture (gpu-glass-element.ts) instead of the
// procedural sky, so the glass refracts real page content — at 60fps, with no
// DOM capture. Slice 1 draws rects; later slices add text/chart instances into
// the same pass, and the glass automatically refracts them too.
import { SCENE_SHADER, SCENE_SKY_SHADER } from "./gpu-scene-shader";
import { packRects, rectCount, type Scene } from "./gpu-scene-model";

export type SceneRenderer = {
  texture: GPUTexture;
  width: number; height: number;
  render: (scene: Scene, scrollY: number, sky: SkyFrame, dpr: number) => void;
  resize: (w: number, h: number) => void;
  destroy: () => void;
};

export type SkyFrame = { top: number[]; hor: number[]; ceil: number; glow: number };
const FORMAT: GPUTextureFormat = "rgba16float";
const MAX_RECTS = 512;

export function createSceneRenderer(device: GPUDevice, w: number, h: number): SceneRenderer {
  const skyMod = device.createShaderModule({ code: SCENE_SKY_SHADER });
  const skyPipe = device.createRenderPipeline({
    layout: "auto", vertex: { module: skyMod, entryPoint: "vs" },
    fragment: { module: skyMod, entryPoint: "fs", targets: [{ format: FORMAT }] },
    primitive: { topology: "triangle-list" },
  });
  const mod = device.createShaderModule({ code: SCENE_SHADER });
  const pipe = device.createRenderPipeline({
    layout: "auto", vertex: { module: mod, entryPoint: "vs" },
    fragment: { module: mod, entryPoint: "fs", targets: [{
      format: FORMAT,
      blend: {
        color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
        alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" },
      },
    }] },
    primitive: { topology: "triangle-list" },
  });

  const ubuf = device.createBuffer({ size: 48, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const rbuf = device.createBuffer({ size: MAX_RECTS * 32, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  const skyBind = device.createBindGroup({ layout: skyPipe.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: ubuf } }] });
  const sceneBind = device.createBindGroup({ layout: pipe.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: ubuf } }, { binding: 1, resource: { buffer: rbuf } }] });

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
      const n = Math.min(rectCount(scene), MAX_RECTS);
      if (n > 0) device.queue.writeBuffer(rbuf, 0, packRects(scene, dpr).subarray(0, n * 8));
      device.queue.writeBuffer(ubuf, 0, new Float32Array([
        r.width, r.height, scrollY, n,
        sky.top[0], sky.top[1], sky.top[2], sky.ceil,
        sky.hor[0], sky.hor[1], sky.hor[2], sky.glow,
      ]));
      const enc = device.createCommandEncoder();
      const pass = enc.beginRenderPass({ colorAttachments: [{
        view: r.texture.createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 1 }, loadOp: "clear", storeOp: "store" }] });
      pass.setPipeline(skyPipe); pass.setBindGroup(0, skyBind); pass.draw(3);
      if (n > 0) { pass.setPipeline(pipe); pass.setBindGroup(0, sceneBind); pass.draw(6, n); }
      pass.end();
      device.queue.submit([enc.finish()]);
    },
    destroy() { r.texture.destroy(); ubuf.destroy(); rbuf.destroy(); },
  };
  return r;
}
